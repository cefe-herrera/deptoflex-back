export interface CurrentUserPayload {
    id: string;
    email: string;
    roles: string[];
}
export declare const CurrentUser: (...dataOrPipes: unknown[]) => ParameterDecorator;
