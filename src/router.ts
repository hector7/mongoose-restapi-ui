import { Router } from 'express'
import { Model, Schema, Document } from 'mongoose'
import { RequestHandler } from 'express'

import { ServeOptions, PERMISSION_MODEL, ROLE_MODEL, PermissionChecks } from './definitions/model'
import permissionSchema, { IPermission } from './models/permissionSchema'

import serveApi from './controllers/model'

import { EventEmitter } from 'events';
import roleSchema, { IRole } from './models/roleSchema';

type Connection = { model: <T extends Document>(el: string, schema: Schema) => Model<T> }
type ApiRouter = Router & {
    roleModel?: () => Model<IRole>
    setModel?: (path: string, Model: Model<any>, ServeOptions?: ServeOptions) => EventEmitter & PermissionChecks
    publishUiTree?: () => RequestHandler
    setGlobalRoute?: (string: string) => void
    setConnection?: (connection: Connection) => void
}

function ApiRouter(...args): ApiRouter {
    let models = {}
    const router: ApiRouter = Router(...args)
    let permissionModel: Model<IPermission> = null
    let roleModel: Model<IRole> = null
    let globalRoute = ''
    router.roleModel = () => roleModel
    router.setGlobalRoute = (path: string) => {
        globalRoute = path
    }
    router.setConnection = (connection: Connection) => {
        permissionModel = connection.model<IPermission>(PERMISSION_MODEL, permissionSchema)
        roleModel = connection.model<IRole>(ROLE_MODEL, roleSchema)
    }
    router.setModel = <T extends Document>(route, model, serveOptions) => {
        const { infoModel, emitter } = serveApi<T>(router, route, model, models, permissionModel, roleModel, serveOptions)
        infoModel.route = `${globalRoute}${route}`
        models[infoModel.name] = infoModel
        return emitter
    }
    router.publishUiTree = () => {
        return (req, res) => {
            res.send(models)
        }
    }

    return <ApiRouter>router
}
export { ApiRouter }