import { Schema, Document } from "mongoose";
import { ROLE_MODEL } from "../definitions/model";
export type IUser = {
    roles: Schema.Types.ObjectId[]
} & Document
const roleSchema = new Schema({
    roles: { type: Schema.Types.ObjectId, ref: ROLE_MODEL }
})
export default roleSchema