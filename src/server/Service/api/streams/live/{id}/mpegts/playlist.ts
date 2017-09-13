import { Operation } from 'express-openapi';
import * as api from '../../../../../api';
import factory from '../../../../../../Model/ModelFactory';
import { StreamsModelInterface } from '../../../../../../Model/Api/StreamsModel';

export const get: Operation = async (req, res) => {
    let streams = <StreamsModelInterface>(factory.get('StreamsModel'));

    try {
        let list = await streams.getLiveM3u8(req.headers.host, req.secure, req.params.id, req.query.mode);
        api.responsePlayList(req, res, list);
    } catch(err) {
        if(err.message === StreamsModelInterface.channleIsNotFoundError) {
            api.responseError(res, { code: 404,  message: 'channel id is not Found' });
        } else {
            api.responseServerError(res, err.message);
        }
    }
};

get.apiDoc = {
    summary: 'mpegts ライブ配信のプレイリストを取得',
    tags: ['streams'],
    description: 'mpegts ライブ配信のプレイリストを取得する',
    parameters: [
        {
            name: 'id',
            in: 'path',
            description: 'channel id',
            required: true,
            type: 'integer'
        },
        {
            name: 'mode',
            in: 'query',
            description: 'encode mode',
            required: true,
            type: 'integer',
        }
    ],
    produces: [
        'application/x-mpegURL',
    ],
    responses: {
        200: {
            description: 'ok'
        },
        404: {
            description: 'Not found'
        },
        default: {
            description: '予期しないエラー',
            schema: {
                $ref: '#/definitions/Error'
            }
        }
    }
};
