import { suite, test } from "mocha-typescript";

import { Path } from '../src/definitions/model'
import * as Utils from '../src/utils'

@suite
class UtilsTest {
    @test("is number function")
    public isNumber() {
        Utils.isNumber('a').should.be.false
        Utils.isNumber('1').should.be.true
        Utils.isNumber('1.2').should.be.true
        Utils.isNumber('.2').should.be.true
    }
    @test("is integer function")
    public isInteger() {
        Utils.isNumber('a').should.be.false
        Utils.isNumber('1').should.be.true
        Utils.isNumber('1.2').should.be.true
        Utils.isNumber('.2').should.be.true
    }
    @test("parse number function")
    public parseNumber() {
        Utils.parseNumberFx('1').should.equal(1)
        Utils.parseNumberFx('1.2').should.equal(1.2)
        Utils.parseNumberFx('.2').should.equal(.2)
    }
    @test("parse ObjectId function")
    public parseObjectId() {
        let n = null
        try {
            Utils.parseObjectId('1')
        } catch (err) {
            n = err
        } finally {
            n.should.exist
        }
        Utils.parseObjectId('123456789012345678901234').constructor.name.should.equals('ObjectID')
    }
    @test("replace ObjectIds function")
    public replaceObjectIds() {
        const objectid: Path = { name: 'objectid', type: 'ObjectId', required: false }
        const object = {
            objectid: '123456789012345678901234'
        }
        Utils.replaceObjectIds([objectid], object)
        object.objectid.constructor.name.should.equals('ObjectID')
        const complexPath: Path = {
            name: 'complex',
            complex: true,
            label: 'x',
            type: 'Array',
            required: false,
            children: [objectid]
        }
        const complexObjectId = {
            complex: [{ objectid: '123456789012345678901234' }]
        }
        Utils.replaceObjectIds([complexPath], complexObjectId)
        complexObjectId.complex[0].objectid.constructor.name.should.equals('ObjectID')
        object.objectid.constructor.name.should.equals('ObjectID')
        let emptyObject = {}
        Utils.replaceObjectIds([complexPath], emptyObject)
        Object.keys(emptyObject).length.should.be.eql(0)
        let wrongObject = {complex: [null]}
        Utils.replaceObjectIds([complexPath], wrongObject)
        wrongObject.should.be.eql({complex: [null]})
    }
}