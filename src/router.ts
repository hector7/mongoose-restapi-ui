import { Router } from 'express'
import serveConfig from './config'
import serveApi from './api'
import { EventEmitter } from 'events';

type ApiRouter = Router & {
    setModel?: (string, Model, ServeOptions?) => EventEmitter,
    publishUI?: () => Router
    setGlobalRoute?: (string) => void
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