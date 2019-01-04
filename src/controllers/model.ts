import { Model, Document } from 'mongoose';
import { Router, Request } from 'express'
import { EventEmitter } from 'events';
import { InfoModel, ServeOptions, PermissionChecks, PermissionRequest } from '../definitions/model'
import RestApiPath from '../models/RestApiPath'
import { IPermission } from '../models/permissionSchema';
import { IRole } from '../models/roleSchema';

type RichEmitter = EventEmitter & PermissionChecks
type returnFunction = { infoModel: InfoModel, emitter: RichEmitter }

export default function <T extends Document>(router: Router, route: string, model: Model<T>,
    models: any, permissionModel: Model<IPermission>, roleModel: Model<IRole>, userOptions?: ServeOptions): returnFunction {
    const path = new RestApiPath<T>(router, route, model, userOptions)
    const permissions = path.setEndPoints(models, permissionModel, roleModel)
    const emitter: EventEmitter & Partial<PermissionChecks> = path.emitter
    emitter.hasAddPermission = permissions.hasAddPermission.bind(permissions)
    emitter.hasUpdatePermission = permissions.hasUpdatePermission.bind(permissions)
    emitter.hasDeletePermission = permissions.hasDeletePermission.bind(permissions)
    emitter.hasAdminPermission = permissions.hasAdminPermission.bind(permissions)
    emitter.getQuery = permissions.getReadQuery.bind(permissions)
    return { infoModel: path.infoModel, emitter: <RichEmitter>emitter }
}