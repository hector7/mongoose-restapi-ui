import { Router } from 'express'
import { Model, Schema, Document } from 'mongoose'
import { RequestHandler, RouterOptions } from 'express'

import { ServeOptions, PERMISSION_MODEL, ROLE_MODEL, PermissionChecks, InfoModel, UserRequest } from './definitions/model'
import permissionSchema, { IPermission } from './models/permissionSchema'

import serveApi, { setRoleEndpoints } from './controllers/model'

import { EventEmitter } from 'events';
import roleSchema, { IRole } from './models/roleSchema';

type Connection = { model: <T extends Document>(el: string, schema: Schema) => Model<T> }
type ApiRouter = Router & {
    roleModel?: () => Model<IRole>
    setModel?: (path: string, Model: Model<any>, ServeOptions?: ServeOptions) => EventEmitter & PermissionChecks
    publishUiTree?: () => RequestHandler
    setRoleEndpoints?: (path?: string) => void
    setGlobalRoute?: (string: string) => void
    setConnection?: (connection: Connection) => void
}

function ApiRouter(): ApiRouter
function ApiRouter(options: { isMongo4?: boolean } & RouterOptions): ApiRouter
function ApiRouter(options = { isMongo4: false }): ApiRouter {
    const { isMongo4, ...routerOptions } = options
    let models: { [modelName: string]: { infoModel: InfoModel, emitter: PermissionChecks } } = {}
    const router: ApiRouter = Router(routerOptions)
    let permissionModel: Model<IPermission> = null
    let roleModel: Model<IRole> = null
    let globalRoute = ''
    router.roleModel = () => roleModel
    router.setGlobalRoute = (path: string) => {
        if (!path.startsWith('/')) console.error('Please, provide a valid path (must be start with slash "/")')
        globalRoute = path.endsWith('/') ? path.slice(0, -1) : path
    }
    router.setConnection = (connection: Connection) => {
        permissionModel = connection.model<IPermission>(PERMISSION_MODEL, permissionSchema)
        roleModel = connection.model<IRole>(ROLE_MODEL, roleSchema)
    }
    router.setModel = <T extends Document>(route, model, serveOptions) => {
        const { infoModel, emitter } = serveApi<T>(router, route, model, models, permissionModel, roleModel, serveOptions, isMongo4)
        infoModel.route = `${globalRoute}${route}`
        models[infoModel.name] = { infoModel, emitter }
        return emitter
    }
    router.setRoleEndpoints = (route = '/roles') => {
        return setRoleEndpoints(router, route, roleModel)
    }
    router.publishUiTree = () => {
        return (req: UserRequest, response) => {
            let map = []
            let target = Object.keys(models).length
            Object.keys(models).forEach(key => {
                models[key].emitter.getMaxPermission(req, (err, perm) => {
                    if (err) return response.status(500).send(err.message)
                    map.push({ ...models[key].infoModel, perm })
                    if (map.length === target) {
                        response.send(map)
                    }
                })
            })
        }
    }

    return <ApiRouter>router
}
export { ApiRouter }