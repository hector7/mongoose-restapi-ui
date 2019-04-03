import { Router } from 'express'
import { Model } from 'mongoose'
import { RequestHandler } from 'express'
import { ServeOptions } from './definitions/model'
import serveApi from './controllers/model'
import { EventEmitter } from 'events';


type ApiRouter = Router & {
    setModel?: (path: string, Model: Model<any>, ServeOptions?: ServeOptions) => EventEmitter,
    publishUiTree?: () => RequestHandler
    setGlobalRoute?: (string: string) => void
}

function ApiRouter(options = { isMongo4: false }): ApiRouter {
    const { isMongo4, ...routerOptions } = options
    let models = {}
    const router: ApiRouter = Router(routerOptions)
    let globalRoute = '/'
    router.setGlobalRoute = (path: string) => {
        globalRoute = path
    }
    router.setModel = (route, model, serveOptions) => {
        const { infoModel, emitter } = serveApi(router, route, model, models, serveOptions, isMongo4)
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