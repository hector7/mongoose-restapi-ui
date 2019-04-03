import { Model } from 'mongoose';
import { Router } from 'express'
import { EventEmitter } from 'events';
import { InfoModel, ServeOptions } from '../definitions/model'
import RestApiPath from '../models/RestApiPath'
type returnFunction = { infoModel: InfoModel, emitter: EventEmitter }

export default function (router: Router, route: string, model: Model<any>,
    models: any, userOptions: ServeOptions, isMongo4: boolean): returnFunction {
    const path = new RestApiPath(router, route, model, userOptions, isMongo4)
    path.setEndPoints(models)
    return { infoModel: path.infoModel, emitter: path.emitter }
}