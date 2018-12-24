import { Router } from 'express'
import { Model, Schema, Document } from 'mongoose'
import { RequestHandler } from 'express'

import { ServeOptions } from './definitions/model'
import permissionSchema, { IPermission } from './models/permissionSchema'

import serveApi from './controllers/model'

import { EventEmitter } from 'events';

type Connection = { model: <T extends Document>(el: string, schema: Schema) => Model<T> }
type ApiRouter = Router & {
    setModel?: (path: string, Model: Model<any>, ServeOptions?: ServeOptions) => EventEmitter,
    publishUiTree?: () => RequestHandler
    setGlobalRoute?: (string: string) => void
    setPermissionsModel?: (connection: Connection) => void
}

function ApiRouter(...args): ApiRouter {
    let models = {}
    const router: ApiRouter = Router(...args)
    let permissionModel: Model<IPermission> = null
    let globalRoute = ''
    router.setGlobalRoute = (path: string) => {
        globalRoute = path
    }

    router.setPermissionsModel = (connection: Connection) => {
        permissionModel = connection.model<IPermission>('Permission', permissionSchema)
    }
    router.setModel = <T extends Document>(route, model, serveOptions) => {
        const { infoModel, emitter } = serveApi<T>(router, route, model, models, permissionModel, serveOptions)
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