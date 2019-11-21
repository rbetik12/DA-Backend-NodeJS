export interface MessageModel {
    _id: string;
    userID: number;
    sender: string;
    text: string;
    longitudea: number;
    altitude: number;
    coefficient?: number;
}