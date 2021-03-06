import * as m from 'mithril';
import * as apid from '../../../../api';
import ApiModel from './ApiModel';

interface AllReserves {
    [key: number]: AllReserveItem;
}

interface AllReserveItem {
    status: 'reserve' | 'conflict' | 'skip';
    item: apid.ReserveAllItem;
}

interface ReservesApiModelInterface extends ApiModel {
    init(): void;
    updateReserves(): Promise<void>;
    updateConflicts(): Promise<void>;
    fetchReserves(limit: number, offset: number): Promise<void>;
    fetchConflicts(limit: number, offset: number): Promise<void>;
    fetchAllId(): Promise<AllReserves | null>;
    fetchConflictCount(): Promise<number>;
    getReserves(): apid.Reserves;
    getConflicts(): apid.Reserves;
    getAllId(): AllReserves | null;
    addReserve(programId: apid.ProgramId, option?: apid.RuleEncode): Promise<void>;
    deleteReserve(programId: apid.ProgramId): Promise<void>;
    deleteSkip(programId: apid.ProgramId): Promise<void>;
}

/**
 * ReservesApiModel
 * /api/reserves を取得
 */
class ReservesApiModel extends ApiModel implements ReservesApiModelInterface {
    private limit: number;
    private offset: number;
    private allReserves: AllReserves | null = null;
    private reserves: apid.Reserves = { reserves: [], total: 0 };
    private conflicts: apid.Reserves = { reserves: [], total: 0 };

    /**
     * 初期化
     */
    public init(): void {
        super.init();
        this.allReserves = null;
        this.reserves = { reserves: [], total: 0 };
        this.conflicts = { reserves: [], total: 0 };
    }

    /**
     * query を現在の状況のまま予約一覧を更新する
     */
    public async updateReserves(): Promise<void> {
        return this.fetchReserves(this.limit, this.offset);
    }

    /**
     * query を現在の状況のまま重複一覧を更新する
     */
    public async updateConflicts(): Promise<void> {
        return this.fetchConflicts(this.limit, this.offset);
    }

    /**
     * 予約一覧を取得
     * /api/reserves
     * @param limit: limit
     * @param offfset: offset
     * @return Promise<void>
     */
    public async fetchReserves(limit: number, offset: number): Promise<void> {
        this.limit = limit;
        this.offset = offset;
        const query = {
            limit: limit,
            offset: offset,
        };

        try {
            this.reserves = await <any> m.request({
                method: 'GET',
                url: '/api/reserves',
                data: query,
            });
        } catch (err) {
            this.reserves = { reserves: [], total: 0 };
            console.error('/api/reserves');
            console.error(err);
            this.openSnackbar('予約情報取得に失敗しました');
        }
    }

    /**
     * 重複一覧を取得
     * /api/reserves/conflicts
     * @param limit: limit
     * @param offfset: offset
     * @return Promise<void>
     */
    public async fetchConflicts(limit: number, offset: number): Promise<void> {
        this.limit = limit;
        this.offset = offset;
        const query = {
            limit: limit,
            offset: offset,
        };

        try {
            this.conflicts = await <any> m.request({
                method: 'GET',
                url: '/api/reserves/conflicts',
                data: query,
            });
        } catch (err) {
            this.conflicts = { reserves: [], total: 0 };
            console.error('/api/reserves/conflicts');
            console.error(err);
            this.openSnackbar('重複情報取得に失敗しました');
        }
    }

    /**
     * すべての予約状態を取得
     * /api/reserves/all
     * @return Promise<void>
     */
    public async fetchAllId(): Promise<AllReserves | null> {
        try {
            const allId = await <any> m.request({
                method: 'GET',
                url: '/api/reserves/all',
            });

            this.allReserves = {};
            for (const reserve of allId.reserves) {
                this.allReserves[reserve.programId] = { status: 'reserve', item: reserve };
            }

            for (const reserve of allId.conflicts) {
                this.allReserves[reserve.programId] = { status: 'conflict', item: reserve };
            }

            for (const reserve of allId.skips) {
                this.allReserves[reserve.programId] = { status: 'skip', item: reserve };
            }
        } catch (err) {
            this.allReserves = null;
            console.error('/api/reserves/all');
            console.error(err);
            this.openSnackbar('予約状態取得に失敗しました');
        }

        return this.allReserves;
    }

    /**
     * conflicts 数を取得
     * /api/reserves/all
     * @return Promise<void>
     */
    public async fetchConflictCount(): Promise<number> {
        try {
            const allId = <apid.ReserveAllId> await <any> m.request({
                method: 'GET',
                url: '/api/reserves/all',
            });

            return allId.conflicts.length;
        } catch (err) {
            console.error('/api/reserves/all');
            console.error(err);
            this.openSnackbar('重複件数取得に失敗しました');
        }

        return 0;
    }

    /**
     * reserves を取得
     * @return apid.Reserves
     */
    public getReserves(): apid.Reserves {
        return this.reserves;
    }

    /**
     * conflicts を取得
     * @return apid.Reserves
     */
    public getConflicts(): apid.Reserves {
        return this.conflicts;
    }

    /**
     * allId を取得
     * @return apid.ReserveAllId | null
     */
    public getAllId(): AllReserves | null {
        return this.allReserves;
    }

    /**
     * 予約追加
     * @param programId: program id
     * @param option: encode option
     * @return Promise<void>
     */
    public async addReserve(programId: apid.ProgramId, option: apid.RuleEncode | null = null): Promise<void> {
        try {
            const query: { programId: number; encode?: apid.RuleEncode } = {
                programId: programId,
            };

            if (option !== null) {
                query.encode = option;
            }

            await <any> m.request({
                method: 'POST',
                url: '/api/reserves',
                data: query,
            });

        } catch (err) {
            console.error('/api/reserves: post');
            throw(err);
        }
    }

    /**
     * 予約削除
     * @param programId: program id
     * @return Promise<void>
     */
    public async deleteReserve(programId: apid.ProgramId): Promise<void> {
        try {
            await <any> m.request({
                method: 'DELETE',
                url: `/api/reserves/${ programId}`,
            });

        } catch (err) {
            console.error(`/api/reserves/${ programId }: delete`);
            throw(err);
        }
    }

    /**
     * 予約除外状態を解除
     * @param programId: program id
     * @return Promise<void>
     */
    public async deleteSkip(programId: apid.ProgramId): Promise<void> {
        try {
            await <any> m.request({
                method: 'DELETE',
                url: `/api/reserves/${ programId}/skip`,
            });

        } catch (err) {
            console.error(`/api/reserves/${ programId }/skip: delete`);
            throw(err);
        }
    }
}

export { AllReserves, AllReserveItem, ReservesApiModelInterface, ReservesApiModel };

