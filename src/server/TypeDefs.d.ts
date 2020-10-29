
export type Primitive = number | string | boolean;
export type SerialData = Primitive | {[k: string]: SerialData} | {[k: number]: SerialData} | SerialData[];
