import * as m from 'mithril';
import * as apid from '../../../../api';
import { ChannelsApiModelInterface } from '../../Model/Api/ChannelsApiModel';
import { ConfigApiModelInterface } from '../../Model/Api/ConfigApiModel';
import { RecordedApiModelInterface } from '../../Model/Api/RecordedApiModel';
import { StreamsApiModelInterface } from '../../Model/Api/StreamsApiModel';
import { BalloonModelInterface } from '../../Model/Balloon/BallonModel';
import { SettingModelInterface } from '../../Model/Setting/SettingModel';
import { TabModelInterface } from '../../Model/Tab/TabModel';
import DateUtil from '../../Util/DateUtil';
import GenreUtil from '../../Util/GenreUtil';
import Util from '../../Util/Util';
import ViewModel from '../ViewModel';

/**
 * RecordedInfoViewModel
 */
class RecordedInfoViewModel extends ViewModel {
    private config: ConfigApiModelInterface;
    private setting: SettingModelInterface;
    private balloon: BalloonModelInterface;
    private recorded: apid.RecordedProgram | null = null;
    private channels: ChannelsApiModelInterface;
    private recordedApiModel: RecordedApiModelInterface;
    private streamApiModel: StreamsApiModelInterface;
    private tab: TabModelInterface;

    public hlsOptionValue: number = 0;
    public kodiOptionValue: number = 0;

    constructor(
        config: ConfigApiModelInterface,
        channels: ChannelsApiModelInterface,
        recordedApiModel: RecordedApiModelInterface,
        streamApiModel: StreamsApiModelInterface,
        balloon: BalloonModelInterface,
        tab: TabModelInterface,
        setting: SettingModelInterface,
    ) {
        super();
        this.config = config;
        this.channels = channels;
        this.recordedApiModel = recordedApiModel;
        this.streamApiModel = streamApiModel;
        this.balloon = balloon;
        this.tab = tab;
        this.setting = setting;
    }

    /**
     * get tab title
     * @return string[]
     */
    public getTabTitles(): string[] {
        const tabs = ['info', 'download'];
        const config = this.config.getConfig();
        if (config !== null && (typeof config.recordedHLS !== 'undefined' || typeof config.kodiHosts !== 'undefined')) {
            tabs.push('stream');
        }

        return tabs;
    }

    /**
     * HLS 配信が有効か
     * @return boolean true: 有効, false: 無効
     */
    public isEnabledRecordedHLS(): boolean {
        const config = this.config.getConfig();

        return config !== null && typeof config.recordedHLS !== 'undefined';
    }

    /**
     * kodi 配信が有効か
     * @return boolean true: 有効, false: 無効
     */
    public isEnabledKodi(): boolean {
        const config = this.config.getConfig();

        return config !== null && typeof config.kodiHosts !== 'undefined';
    }

    /**
     * recorded のセット
     * @param recorded: recorded
     */
    public set(recorded: apid.RecordedProgram): void {
        this.recorded = recorded;
    }

    /**
     * recorded を更新する
     */
    public update(): void {
        if (this.recorded === null) { return; }

        for (const data of this.recordedApiModel.getRecorded().recorded) {
            if (data.id === this.recorded.id) {
                // 更新
                this.recorded = data;
                setTimeout(() => { m.redraw(); }, 200);

                return;
            }
        }

        // 一覧から削除された
        this.close();
    }

    /**
     * get video source
     * @param download: true: download mode, false: not download mode
     * @return video source
     */
    public getVideoSrc(download: boolean = false): { name: string; path: string; filesize: string | null }[] {
        const config = this.config.getConfig();
        const setting = this.setting.get();
        if (this.recorded === null || config === null || setting === null) { return []; }

        // url scheme 用のベースリンクを取得
        let urlScheme: string | null = null;

        let isEnableUrlScheme = false;
        if (download) {
            if (setting.isEnableRecordedDownloaderURLScheme) {
                urlScheme = setting.customRecordedDownloaderURLScheme;
                isEnableUrlScheme = true;
            }
        } else {
            if (setting.isEnableRecordedViewerURLScheme) {
                urlScheme = setting.customRecordedViewerURLScheme;
                isEnableUrlScheme = true;
            }
        }

        if (urlScheme === null && isEnableUrlScheme) {
            const app: { ios: string; android: string; mac: string; win: string } | undefined = download ? config.recordedDownloader : config.recordedViewer;
            if (typeof app !== 'undefined') {
                if (Util.uaIsiOS() && typeof app.ios !== 'undefined') {
                    urlScheme = app.ios;
                } else if (Util.uaIsAndroid() && typeof app.android !== 'undefined') {
                    urlScheme = app.android;
                } else if (Util.uaIsMac() && !Util.uaIsSafari() && typeof app.mac !== 'undefined') {
                    urlScheme = app.mac;
                } else if (Util.uaIsWindows() && typeof app.win !== 'undefined') {
                    urlScheme = app.win;
                }
            }
        }

        const result: { name: string; path: string; filesize: string | null }[] = [];
        // ts ファイル
        if (this.recorded.original) {
            let url = download ? `/api/recorded/${ this.recorded.id }/file?mode=download` : `/api/recorded/${ this.recorded.id }/file`;
            if (urlScheme !== null) {
                let full = location.host + url;
                if (urlScheme.match(/vlc-x-callback/)) { full = encodeURIComponent(full); }
                url = urlScheme.replace(/ADDRESS/g, full);
                if (typeof this.recorded.filename !== 'undefined') {
                    url = url.replace(/FILENAME/g, this.recorded.filename);
                }
            }
            result.push({
                name: 'TS',
                path: url,
                filesize: this.createFileSizeStr(this.recorded.filesize),
            });
        }

        // エンコード済みファイル
        if (typeof this.recorded.encoded !== 'undefined') {
            for (const encoded of this.recorded.encoded) {
                let url = download ? `/api/recorded/${ this.recorded.id }/file?encodedId=${ encoded.encodedId }&mode=download`
                        : `/api/recorded/${ this.recorded.id }/file?encodedId=${ encoded.encodedId }`;
                if (urlScheme !== null) {
                    let full = location.host + url;
                    if (urlScheme.match(/vlc-x-callback/)) { full = encodeURIComponent(full); }
                    url = urlScheme.replace(/ADDRESS/g, full);
                    url = url.replace(/FILENAME/g, encoded.filename);
                }
                result.push({
                    name: encoded.name,
                    path: url,
                    filesize: this.createFileSizeStr(encoded.filesize),
                });
            }
        }

        return result;
    }

    /**
     * create file size str
     * @param size: number | undefined
     * @return string | null
     */
    private createFileSizeStr(size: number | undefined): string | null {
        if (typeof size === 'undefined') { return null; }

        let cnt = 0;
        for (; cnt <= RecordedInfoViewModel.fileSizeUnits.length; cnt++) {
            if (size < 1000) { break; }
            size /= 1024;
        }

        return `${ size.toFixed(1) }${ RecordedInfoViewModel.fileSizeUnits[cnt] }`;
    }

    /**
     * エンコード待機、エンコード中の情報を取得
     */
    public getEncoding(): { name: string; isEncoding: boolean }[] {
        return this.recorded === null || typeof this.recorded.encoding === 'undefined' ? [] : this.recorded.encoding;
    }

    /**
     * get playlist
     * @param download: true: download mode, false: not download mode
     * @return video source
     */
    public getPlayList(): { name: string; path: string }[] {
        const config = this.config.getConfig();
        if (this.recorded === null || config === null) { return []; }

        const result: { name: string; path: string }[] = [];

        // ts ファイル
        if (this.recorded.original) {
            result.push({ name: 'TS', path: `/api/recorded/${ this.recorded.id }/playlist` });
        }

        // エンコード済みファイル
        if (typeof this.recorded.encoded !== 'undefined') {
            for (const encoded of this.recorded.encoded) {
                result.push({ name: encoded.name, path: `/api/recorded/${ this.recorded.id }/playlist?encodedId=${ encoded.encodedId }` });
            }
        }

        return result;
    }

    /**
     * get thumbnail source
     * @return string
     */
    public getThumnbailSrc(): string | null {
        return this.recorded === null || !this.recorded.hasThumbnail ? '/img/noimg.png' : `/api/recorded/${ this.recorded.id }/thumbnail`;
    }

    /**
     * title の取得
     * @return recorded
     */
    public getTitle(): string {
        return this.recorded === null ? '' : this.recorded.name;
    }

    /**
     * id を指定して channel 名を取得する
     * @param channelId: channel id
     * @return string
     */
    public getChannelName(): string {
        if (this.recorded === null) { return ''; }
        const channel = this.channels.getChannel(this.recorded.channelId);

        return channel === null ? String(this.recorded.channelId) : channel.name;
    }

    /**
     * get time str
     * @return string
     */
    public getTimeStr(): string {
        if (this.recorded === null) { return ''; }

        const start = DateUtil.getJaDate(new Date(this.recorded.startAt));
        const end = DateUtil.getJaDate(new Date(this.recorded.endAt));
        const duration = Math.floor((this.recorded.endAt - this.recorded.startAt) / 1000 / 60);

        return DateUtil.format(start, 'MM/dd(w) hh:mm:ss') + ' ~ ' + DateUtil.format(end, 'hh:mm:ss') + `(${ duration }分)`;
    }

    /**
     * genre1, genre2 をまとめて取得
     * @return genre1 / genre2
     */
    public getGenres(): string {
        if (this.recorded === null || typeof this.recorded.genre1 === 'undefined') { return ''; }

        return GenreUtil.getGenres(this.recorded.genre1, this.recorded.genre2);
    }

    /**
     * description の取得
     * @return recorded
     */
    public getDescription(): string {
        return this.recorded === null || typeof this.recorded.description === 'undefined' ? '' : this.recorded.description;
    }

    /**
     * extended の取得
     * @return recorded
     */
    public getExtended(): string {
        return this.recorded === null || typeof this.recorded.extended === 'undefined' ? '' : this.recorded.extended;
    }

    /**
     * HLS 配信用の selector の設定を取得
     * @return { value: number, name: string }[]
     */
    public getHLSOptions(): { value: number; name: string }[] {
        const config = this.config.getConfig();
        if (config === null || typeof config.recordedHLS === 'undefined') { return []; }

        return config.recordedHLS.map((option, index) => {
            return { value: index, name: option };
        });
    }

    /**
     * 配信用の video 情報を返す
     * @return { name: string, encodedId?: number }[]
     */
    public getVideoInfo(): { name: string; encodedId?: number }[] {
        if (this.recorded === null) { return []; }

        const result: { name: string; encodedId?: number }[] = [];
        // ts ファイル
        if (this.recorded.original) {
            result.push({ name: 'TS' });
        }

        // エンコード済みファイル
        if (typeof this.recorded.encoded !== 'undefined') {
            for (const encoded of this.recorded.encoded) {
                result.push({ name: encoded.name, encodedId: encoded.encodedId });
            }
        }

        return result;
    }

    /**
     * HLS 配信開始 & 該当ページへ移動
     * @param encodedId: encoded id
     */
    public async startHLSStreaming(encodedId: number | null = null): Promise<void> {
        if (this.recorded === null) { return; }

        // HLS 配信開始
        const streamNumber = await this.streamApiModel.startRecordedHLS(
            this.recorded.id,
            this.hlsOptionValue,
            encodedId,
        );

        this.close();

        // ページ移動
        setTimeout(() => { Util.move('/stream/watch', { stream: streamNumber }); }, 200);
    }

    /**
     * kodi 配信用の selector の設定を取得
     * @return { value: number, name: string }[]
     */
    public getKodiOptions(): { value: number; name: string }[] {
        const config = this.config.getConfig();
        if (config === null || typeof config.kodiHosts === 'undefined') { return []; }

        return config.kodiHosts.map((option, index) => {
            return { value: index, name: option };
        });
    }

    /**
     * kodi への配信
     * @param encodedId: encoded id
     */
    public async sendToKodi(encodedId: number | null = null): Promise<void> {
        if (this.recorded === null) { return; }

        // kodi 配信開始
        await this.recordedApiModel.sendToKodi(
            this.kodiOptionValue,
            this.recorded.id,
            encodedId,
        );
    }

    /**
     * 開いているか
     * @return true: open, false: close
     */
    public isOpen(): boolean {
        return this.balloon.isOpen(RecordedInfoViewModel.id);
    }

    /**
     * close balloon
     */
    public close(): void {
        this.balloon.close();
    }

    /**
     * tab position
     */
    public getTabPosition(): number {
        return this.tab.get();
    }
}

namespace RecordedInfoViewModel {
    export const id = 'recorded-info';
    export const fileSizeUnits = ['B', 'KB', 'MB', 'GB'];
}

export default RecordedInfoViewModel;

