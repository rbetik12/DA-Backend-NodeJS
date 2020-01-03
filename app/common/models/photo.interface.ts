import { ObjectID } from "mongodb";

export interface Photo {
    _id?: ObjectID,
    user_id: ObjectID,
    data: string
}