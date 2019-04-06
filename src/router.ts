import { Router } from 'express'
import { Model, Schema, Document } from 'mongoose'
import { RequestHandler, RouterOptions } from 'express'

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

function ApiRouter(): ApiRouter
function ApiRouter(options: { isMongo4?: boolean } & RouterOptions): ApiRouter
function ApiRouter(options = { isMongo4: false }): ApiRouter {
    const { isMongo4, ...routerOptions } = options
    let models = {}
    const router: ApiRouter = Router(routerOptions)
    let permissionModel: Model<IPermission> = null
    let roleModel: Model<IRole> = null
    let globalRoute = '/'
    router.roleModel = () => roleModel
    router.setGlobalRoute = (path: string) => {
        globalRoute = path
    }
    router.setConnection = (connection: Connection) => {
        permissionModel = connection.model<IPermission>(PERMISSION_MODEL, permissionSchema)
        roleModel = connection.model<IRole>(ROLE_MODEL, roleSchema)
    }
    router.setModel = <T extends Document>(route, model, serveOptions) => {
        const { infoModel, emitter } = serveApi<T>(router, route, model, models, permissionModel, roleModel, serveOptions, isMongo4)
        infoModel.route = `${globalRoute}${route}`
        models[infoModel.name] = infoModel
        return emitter
    }
    router.publishUiTree = () => {
        return (req, res) => {
            res.send(Object.keys(models).map(key => models[key]))
        }
    }

    return <ApiRouter>router
}
export { ApiRouter }