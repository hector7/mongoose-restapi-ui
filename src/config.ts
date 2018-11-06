import * as express from 'express';
import { Router } from 'express'
import { join } from 'path'
export default function (router: Router, models): void {
    router.use('/', express.static(join(__dirname, 'frontend')))
    router.get('/index.html', (req, res) => {
        res.sendFile(join(__dirname, 'frontend', 'index.html'))
    })
    router.get('/tree', (req, res) => {
        res.send(models)
    })
}