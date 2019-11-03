
export interface User {
    name: string,
        email: string,
        gender: string,
        age: number,
        about: string,
        interests: string[],
    
        [key: string]: any
}
