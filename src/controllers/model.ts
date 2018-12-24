import { Model, Document } from 'mongoose';
import { Router } from 'express'
import { EventEmitter } from 'events';
import { InfoModel, ServeOptions } from '../definitions/model'
import RestApiPath from '../models/RestApiPath'
import { IPermission } from '../models/permissionSchema';
type returnFunction = { infoModel: InfoModel, emitter: EventEmitter }

export default function <T extends Document>(router: Router, route: string, model: Model<T>,
    models: any, permissionModel: Model<IPermission>, userOptions?: ServeOptions): returnFunction {
    const path = new RestApiPath<T>(router, route, model, userOptions)
    path.setEndPoints(models, permissionModel)
    return { infoModel: path.infoModel, emitter: path.emitter }
}