import { Schema, Document } from "mongoose";
export type IPermission = {
    table: string,
    object: any,
    user?: any,
    role?: any,
    read?: boolean,
    write?: boolean,
    admin?: boolean
} & Document
const permissionSchema = new Schema({
    table: { type: String, required: true },
    object: { type: Schema.Types.ObjectId, required: true },
    user: Schema.Types.ObjectId,
    role: Schema.Types.ObjectId,
    read: Boolean,
    write: Boolean,
    admin: Boolean
})

export default permissionSchema