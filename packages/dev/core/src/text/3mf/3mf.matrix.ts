
/*
  In the XSD, ST_Matrix3D is a whitespace separated list of numbers.
  The official 3MF core spec uses a 3x4 matrix (12 numbers).
*/
export type ST_Matrix3D = [
  number, number, number, number,
  number, number, number, number,
  number, number, number, number
];

export class Matrix3D {

  public static Identity = new Matrix3D([1,0,0,0,1,0,0,0,1,0,0,0]);

  public static Translate(x:number,y:number,z:number) { return new Matrix3D([1,0,0,0,1,0,0,0,1,x,y,z]); }

  constructor(public values: ST_Matrix3D) {}

  toString(): string {
    return this.values.join(" ");
  }

  static fromString(value: string): Matrix3D {
    const parts = value.trim().split(/\s+/).map(Number);
    if (parts.length !== 12 || parts.some((n) => Number.isNaN(n))) {
      throw new Error("Invalid ST_Matrix3D, expected 12 numbers");
    }
    return new Matrix3D(parts as ST_Matrix3D);
  }
}