import * as events from 'events';
import * as apid from '../../../../node_modules/mirakurun/api';
import Model from '../Model';
import { ReserveAllId, ReserveLimit } from '../Operator/Reservation/ReservationManageModel';
import { EncodeInterface, RuleInterface } from '../Operator/RuleInterface';
import { EncodeModelInterface } from '../Service/Encode/EncodeModel';
import { SocketIoManageModelInterface } from '../Service/SocketIoManageModel';
import { IPCClientMessage, IPCMessageDefinition, IPCServerEncodeMessage, IPCServerMessage, IPCServerSocketIoMessage } from './IPCMessageInterface';

interface IPCClientInterface extends Model {
    getReserveAllId(): Promise<ReserveAllId>;
    getReserves(limit: number, offset: number): Promise<ReserveLimit>;
    getReserveConflicts(limit: number, offset: number): Promise<ReserveLimit>;
    getReserveSkips(limit: number, offset: number): Promise<ReserveLimit>;
    addReserve(programId: apid.ProgramId, encode?: EncodeInterface): Promise<void>;
    cancelReserve(programId: apid.ProgramId): Promise<void>;
    removeReserveSkip(programId: apid.ProgramId): Promise<void>;
    recordedDelete(recordedId: number): Promise<void>;
    recordedDeleteFile(recordedId: number): Promise<void>;
    recordedDeleteEncodeFile(encodedId: number): Promise<void>;
    ruleDisable(ruleId: number): Promise<void>;
    ruleEnable(ruleId: number): Promise<void>;
    ruleDelete(ruleId: number): Promise<void>;
    ruleAdd(rule: RuleInterface): Promise<number>;
    ruleUpdate(ruleId: number, rule: RuleInterface): Promise<void>;
    addEncodeFile(recordedId: number, name: string, filePath: string, delTs: boolean): Promise<number>;
    updateTsFileSize(recordedId: number): Promise<void>;
    updateReserves(): Promise<void>;
}

/**
 * IPC 通信クライアント
 * @throws IPCClientCreateInstanceError init が呼ばれていないとき
 * @throws IPCClientIsNotChildProcess fork で起動していないとき
 */
class IPCClient extends Model implements IPCClientInterface {
    private encodeModel: EncodeModelInterface;
    private socketIo: SocketIoManageModelInterface;
    private listener: events.EventEmitter = new events.EventEmitter();

    constructor() {
        super();

        if (typeof process.send === 'undefined') {
            this.log.system.error('IPCClient is not child process');
            throw new Error('IPCClientIsNotChildProcess');
        }

        process.on('message', (msg: IPCServerMessage | IPCServerSocketIoMessage | IPCServerEncodeMessage) => {
            if (typeof (<IPCServerMessage> msg).id === 'undefined') {
                if ((<IPCServerEncodeMessage> msg).msg === IPCMessageDefinition.setEncodeToClient) {
                    // server からのエンコード依頼
                    this.encodeModel.push((<IPCServerEncodeMessage> msg).program);
                } else {
                    // server からの socket.io message 送信依頼
                    this.socketIo.notifyClient();
                }
            } else {
                // client -> server の返答
                this.listener.emit(String((<IPCServerMessage> msg).id), msg);
            }
        });
    }

    public setModels(
        encodeModel: EncodeModelInterface,
        socketIo: SocketIoManageModelInterface,
    ): void {
        this.encodeModel = encodeModel;
        this.socketIo = socketIo;
    }

    /**
     * 予約に含まれるの program id だけを取得する
     * @return Promise<ReserveAllId>
     */
    public async getReserveAllId(): Promise<ReserveAllId> {
        const id = this.send(IPCMessageDefinition.getReserveAllId);
        const result = await this.receive(id);

        return <ReserveAllId> result.value;
    }

    /**
     * 予約一覧を取得する
     * @return Promise<ReserveLimit>
     */
    public async getReserves(limit: number, offset: number): Promise<ReserveLimit> {
        const id = this.send(IPCMessageDefinition.getReserves, { limit: limit, offset: offset });
        const result = await this.receive(id);

        return <ReserveLimit> result.value;
    }

    /**
     * 重複を取得する
     * @return Promise<ReserveLimit>
     */
    public async getReserveConflicts(limit: number, offset: number): Promise<ReserveLimit> {
        const id = this.send(IPCMessageDefinition.getReserveConflicts, { limit: limit, offset: offset });
        const result = await this.receive(id);

        return <ReserveLimit> result.value;
    }

    /**
     * スキップを取得する
     * @return Promise<ReserveLimit>
     */
    public async getReserveSkips(limit: number, offset: number): Promise<ReserveLimit> {
        const id = this.send(IPCMessageDefinition.getReserveSkips, { limit: limit, offset: offset });
        const result = await this.receive(id);

        return <ReserveLimit> result.value;
    }

    /**
     * 予約追加
     * @param programId: program id
     * @param encode: EncodeInterface
     * @return Promise<void>
     */
    public async addReserve(programId: apid.ProgramId, encode?: EncodeInterface): Promise<void> {
        const args = { programId: programId };
        if (typeof encode !== 'undefined') { args['encode'] = encode; }
        const id = this.send(IPCMessageDefinition.addReserve, args);
        await this.receive(id);
    }

    /**
     * 予約キャンセル
     * @param programId: program id
     * @return Promise<void>
     */
    public async cancelReserve(programId: apid.ProgramId): Promise<void> {
        const id = this.send(IPCMessageDefinition.cancelReserve, { programId: programId });
        await this.receive(id);
    }

    /**
     * 予約対象から除外され状態を解除する
     * @param programId: program id
     * @return Promise<void>
     */
    public async removeReserveSkip(programId: apid.ProgramId): Promise<void> {
        const id = this.send(IPCMessageDefinition.removeReserveSkip, { programId: programId });
        await this.receive(id);
    }

    /**
     * 録画を削除する
     * @param recordedId: recorded id
     * @return Promise<void>
     */
    public async recordedDelete(recordedId: number): Promise<void> {
        const id = this.send(IPCMessageDefinition.recordedDelete, { recordedId: recordedId });
        await this.receive(id);
    }

    /**
     * 録画の ts ファイルを削除する
     * @param recordedId: recorded id
     * @return Promise<void>
     */
    public async recordedDeleteFile(recordedId: number): Promise<void> {
        const id = this.send(IPCMessageDefinition.recordedFileDelete, { recordedId: recordedId });
        await this.receive(id);
    }

    /**
     * 録画の encoded ファイルを削除する
     * @param encodedId: encoded id
     * @return Promise<void>
     */
    public async recordedDeleteEncodeFile(encodedId: number): Promise<void> {
        const id = this.send(IPCMessageDefinition.recordedEncodeFileDelete, { encodedId: encodedId });
        await this.receive(id);
    }

    /**
     * rule を無効化する
     * @param ruleId: rule id
     * @return Promise<void>
     */
    public async ruleDisable(ruleId: number): Promise<void> {
        const id = this.send(IPCMessageDefinition.ruleDisable, { ruleId: ruleId });
        await this.receive(id);
    }

    /**
     * rule を有効化する
     * @param ruleId: rule id
     * @return Promise<void>
     */
    public async ruleEnable(ruleId: number): Promise<void> {
        const id = this.send(IPCMessageDefinition.ruleEnable, { ruleId: ruleId });
        await this.receive(id);
    }

    /**
     * rule を削除する
     * @param ruleId: rule id
     * @return Promise<void>
     */
    public async ruleDelete(ruleId: number): Promise<void> {
        const id = this.send(IPCMessageDefinition.ruleDelete, { ruleId: ruleId });
        await this.receive(id);
    }

    /**
     * rule を追加する
     * @param rule: RuleInterface
     * @return Promise<number>: rule id
     */
    public async ruleAdd(rule: RuleInterface): Promise<number> {
        const id = this.send(IPCMessageDefinition.ruleAdd, { rule: rule });
        const result = await this.receive(id);

        return <number> result.value;
    }

    /**
     * rule を更新する
     * @param rule: RuleInterface
     * @return Promise<void>
     */
    public async ruleUpdate(ruleId: number, rule: RuleInterface): Promise<void> {
        const id = this.send(IPCMessageDefinition.ruleUpdate, { ruleId: ruleId, rule: rule });
        await this.receive(id);
    }

    /**
     * エンコード済みファイルを追加する
     * @return Promise<number> encodedId
     */
    public async addEncodeFile(recordedId: number, name: string, filePath: string, delTs: boolean): Promise<number> {
        const id = this.send(IPCMessageDefinition.addEncodeFile, {
            recordedId: recordedId,
            name: name,
            filePath: filePath,
            delTs: delTs,
        });
        const result = await this.receive(id);

        return <number> result.value;
    }

    /**
     * ts ファイルのサイズを更新
     * @param recordedId: recorded id
     * @return Promise<void>
     */
    public async updateTsFileSize(recordedId: number): Promise<void> {
        const id = this.send(IPCMessageDefinition.updateTsFileSize, {
            recordedId: recordedId,
        });
        await this.receive(id);
    }

    /**
     * 予約情報の更新
     * @return Promise<void>
     */
    public async updateReserves(): Promise<void> {
        const id = this.send(IPCMessageDefinition.updateReserves);
        await this.receive(id);
    }

    /**
     * message 送信
     * @param msg: string
     * @param value: any
     * @return id
     */
    private send(msg: string, value: any | null = null): number {
        const data: IPCClientMessage = {
            id: new Date().getTime(),
            msg: msg,
        };

        if (value !== null) {
            data.value = value;
        }

        setTimeout(() => { process.send!(data); }, 0);

        return data.id;
    }

    /**
     * 受信
     * @param id: number
     * @return Promise<IPCServerMessage>
     */
    private receive(id: number): Promise<IPCServerMessage> {
        return new Promise<IPCServerMessage>((resolve: (msg: IPCServerMessage) => void, reject: (err: Error) => void) => {
            this.listener.once(String(id), (msg: IPCServerMessage) => {
                if (typeof msg.error !== 'undefined') {
                    reject(new Error(msg.error));
                } else {
                    resolve(msg);
                }
            });

            // timeout
            setTimeout(() => {
                reject(new Error('IPCTimeout'));
            }, 5000);
        });
    }
}

export { IPCClientInterface, IPCClient };

