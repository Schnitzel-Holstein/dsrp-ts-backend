import { db } from "../lib/database";

/**
 * Check if an user has all roles
 * @param id 
 * @param roles 
 */
export const hasAllRoles = async (id: number, roles: string[] | string): Promise<boolean> => {
    if(typeof(roles) === "string") {
        let role = roles;
        roles = [];
        roles.push(role);
    }
    return new Promise<boolean>((resolve) => {
        db.task(async t => {
            const userRoles = (
                await t.query(
                    'SELECT user_roles.name FROM user_roles INNER JOIN user_roles_inventory as roles ON roles.role_id=user_roles.id AND roles.user_id=$1',
                    [id]
                )).map((r:any) => r.name);
            for(const role of roles) {
                if(!userRoles.includes(role)) {
                    return resolve(false);
                }
            }
            return resolve(true);
        });

    });

}

/**
 * Check if an user has any of sent roles
 * @param id 
 * @param roles 
 */
export const hasAnyOfTheseRoles = async (id: number, roles: string[] | string) => {
    if(typeof(roles) === "string") {
        let role = roles;
        roles = [];
        roles.push(role);
    }
    return new Promise<boolean>((resolve) => {
        db.task(async t => {
            const userRoles = (
                await t.query(
                    'SELECT user_roles.name FROM user_roles INNER JOIN user_roles_inventory as roles ON roles.role_id=user_roles.id AND roles.user_id=$1',
                    [id]
                )).map((r:any) => r.name);
            for(const role of roles) {
                if(userRoles.includes(role)) {
                    return resolve(true);
                }
            }
            return resolve(false);
        });
    });
}

/**
 * Check if an user has that role
 * @param id
 * @param role 
 */
export const hasRole = async (id: number, role: string) => {
    return new Promise<boolean>((resolve) => {
        db.task(async t => {
            const userRoles = (
                await t.query(
                    'SELECT user_roles.name FROM user_roles INNER JOIN user_roles_inventory as roles ON roles.role_id=user_roles.id AND roles.user_id=$1',
                    [id]
                )).map((r:any) => r.name);
            
            return resolve(userRoles.includes(role));
            
        });
    });
}