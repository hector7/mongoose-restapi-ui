import { suite, test } from "mocha-typescript";

import RestApiPath from '../src/models/RestApiPath'
import { Router, RequestHandler, IRouter, IRouterMatcher } from 'express';
import { PathParams } from "express-serve-static-core";
const mongoose = require("mongoose");


@suite
class RestApiPathTest {
    @test("constructor populates objects to getters")
    public constructorPopulation() {
        const r = Router()
        var model = mongoose.model('x', new mongoose.Schema({}))
        var ra = new RestApiPath(r, '', model, {})
        ra.router.should.equal(r)
        ra.route.should.equal('')
        ra.model.should.equal(model)
        ra.options.name.should.equal('name')
        ra.emitter.constructor.name.should.equal('EventEmitter')
        ra.paths.length.should.equal(2)
        ra.paths[0].name.should.equal('_id')
        ra.paths[0].type.should.equal('ObjectId')
        ra.paths[1].name.should.equal('__v')
        ra.paths[1].type.should.equal('Number')
        ra.numberFullPaths.length.should.equal(1)
        ra.numberFullPaths[0].should.equal('__v')
        model = mongoose.model('y', new mongoose.Schema({
            string: String,
            number: Number,
            date: Date,
            array: [{ number: Number }]
        }))
        const thepath = 'the path'
        ra = new RestApiPath(r, thepath, model, {})
        ra.paths.length.should.equal(6)
        ra.paths[0].name.should.equal('string')
        ra.paths[1].name.should.equal('number')
        ra.paths[2].name.should.equal('date')
        ra.paths[3].name.should.equal('array')
        ra.paths[4].name.should.equal('_id')
        ra.paths[5].name.should.equal('__v')
        ra.numberFullPaths.length.should.equal(3)
        ra.numberFullPaths[0].should.equal('number')
        ra.numberFullPaths[1].should.equal('array.number')
        ra.stringFullPaths.length.should.equal(1)
        ra.stringFullPaths[0].should.equal('string')
        ra.dateFullPaths.length.should.equal(1)
        ra.dateFullPaths[0].should.equal('date')
    }
}