import { Router } from 'express'
import { Model } from 'mongoose'
import serveConfig from './config'
import serveApi from './api'
import { EventEmitter } from 'events';
import { ServeOptions } from './api'

type ApiRouter = Router & {
    setModel?: (path: string, Model: Model<any>, ServeOptions?: ServeOptions) => EventEmitter,
    publishUI?: () => Router
    setGlobalRoute?: (string: string) => void
}

function ApiRouter(...args): ApiRouter {
    let models = []
    const router: ApiRouter = Router(...args)
    let globalRoute = ''
    router.setGlobalRoute = (path: string) => {
        globalRoute = path
    }
    router.setModel = (route, model, serveOptions) => {
        const { infoModel, emitter } = serveApi(router, route, model, serveOptions)
        infoModel.route = `${globalRoute}${route}`
        models.push(infoModel)
        return emitter
    }
    router.publishUI = (uiRouter?: Router) => {
        const r = uiRouter ? uiRouter : router
        serveConfig(r, models)
        return r
    }

    return <ApiRouter>router
}
export { ApiRouter }