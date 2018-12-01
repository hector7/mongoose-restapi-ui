import { Model } from 'mongoose';
import { Router } from 'express'
import { EventEmitter } from 'events';
import '../defintions/model'
import RestApiPath from '../models/RestApiPath'
type returnFunction = { infoModel: InfoModel, emitter: EventEmitter }

export default function (router: Router, route: string, model: Model<any>,
    models: any, userOptions?: ServeOptions): returnFunction {
    const path = new RestApiPath(router, route, model, userOptions)
    path.setEndPoints(models)
    return { infoModel: path.infoModel, emitter: path.emitter }
}