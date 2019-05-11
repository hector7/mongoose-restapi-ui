import { Model, Document } from 'mongoose';
import { Router, Request } from 'express'
import { EventEmitter } from 'events';
import { InfoModel, ServeOptions, PermissionChecks } from '../definitions/model'
import RestApiPath from '../models/RestApiPath'
import { IPermission } from '../models/permissionSchema';
import { IRole } from '../models/roleSchema';

type RichEmitter = EventEmitter & PermissionChecks
type returnFunction = { infoModel: InfoModel, emitter: RichEmitter }

export function setRoleEndpoints(router: Router, route: string, roleModel: Model<IRole>) {
    return RestApiPath.setRoleEndpoints(router, route.endsWith('/') ? route.slice(0, -1) : route, roleModel)
}

export default function <T extends Document>(router: Router, route: string, model: Model<T>,
    models: any, permissionModel: Model<IPermission>, roleModel: Model<IRole>, userOptions: ServeOptions, isMongo4: boolean): returnFunction {
    const path = new RestApiPath<T>(router, route, model, userOptions, isMongo4)
    const permissions = path.setEndPoints(models, permissionModel, roleModel)
    const emitter: EventEmitter & Partial<PermissionChecks> = path.emitter
    emitter.hasAddPermission = permissions.hasAddPermission.bind(permissions)
    emitter.hasUpdatePermission = permissions.hasUpdatePermission.bind(permissions)
    emitter.hasDeletePermission = permissions.hasDeletePermission.bind(permissions)
    emitter.hasAdminPermission = permissions.hasAdminPermission.bind(permissions)
    emitter.getFilterByPermissions = permissions.getReadQuery.bind(permissions)
    emitter.getMaxPermission = permissions.getMaxPermissionByTable.bind(permissions)
    return { infoModel: path.infoModel, emitter: <RichEmitter>emitter }
}