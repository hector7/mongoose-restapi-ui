import { Types } from 'mongoose';
import { ObjectID } from 'bson';

const { ObjectId } = Types
export function isNumber(val: any): boolean {
    return !isNaN(val)
}
export function isInteger(val: string): boolean {
    return /^\d+$/.test(val);
}

export function parseNumberFx(el): number {
    let res = parseFloat(el)
    if (isInteger(el))
        res = parseInt(el, 10)
    return res
}

export function parseObjectId(el): ObjectID {
    return new ObjectId(el)
}

export function containsStringFx(el) {
    return {
        $regex: `.*${el}.*`,
        $options: 'i'
    }
}

export function replaceObjectIds(paths: Path[], object): void {
    paths.forEach(path => {
        if (path.type === 'Array')
            object[path.name].forEach(subEl => {
                replaceObjectIds(path.children, subEl)
            })
        if (path.type === 'ObjectId') {
            if (object[path.name])
                object[path.name] = ObjectId(object[path.name])
        }
    })
}