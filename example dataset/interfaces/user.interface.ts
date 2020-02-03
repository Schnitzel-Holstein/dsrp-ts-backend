export interface Role {
    id: number;
    name: string;
    color: string;
    type: string;
    image?: string;
    isActive: boolean;
}

export interface Field {
    id: number;
    name: string;
    value: string;
    displayOnProfile: boolean;
    displayOnPost: boolean;
    displayToUser: boolean;
}


export interface User {
    id: number;
    username: string;
    email?: string;
    messages: number;
    lastRequest: Date;
    createdAt: Date;
    UpdateAt: Date;
    fields: Field[];
    roles: Role[];
    avatar: string;
    signature: string;
}