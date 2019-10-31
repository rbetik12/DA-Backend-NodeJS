
export interface User {
    name: string,
        email: string,
        gender: string,
        age: number,
        about: string,
        interests: string[],
    
        [key: string]: any
}

const users: User[] = [{
    name: 'Vitaliy',
    about: 'llfdlewf',
    email: 'lol@gmail.com',
    gender: 'M',
    age: 19,
    interests: ['kek'],
    password: '123456'
}];