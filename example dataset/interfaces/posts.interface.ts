import { User } from "./user.interface";

export interface Post {
    id: number;
    name: string;
    description?: string;
    createdBy: User;
    content: string;
}

export interface Thread {
    id: number;
    name: string;
    description?: string;
    createdAt: Date;
    updatedAt: Date;
    createdBy: User;
    lastMessageBy: User;
    lastMessageAt: Date;
}

export interface SubCategory{
    id: number;
    name: string;
    description?: string;
    threads: Thread[];
    lastMessageBy: User;
    lastMessageAt: Date;
    color: string;
    image: string;
}

export interface Category {
    id: number;
    name: string;
    description?: string;
    subCategories: SubCategory[];
    createdAt: Date;
    updatedAt: Date;
    color: string;
    image: string;
}