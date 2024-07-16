import { IVectorTileFeature } from "./tiles.vector.interfaces";

export type FilterFunc<T> = (feature: T) => boolean;

export type FilterSpecification =
    | ["has", string]
    | ["!has", string]
    | ["==", string, string | number | boolean]
    | ["!=", string, string | number | boolean]
    | [">", string, string | number | boolean]
    | [">=", string, string | number | boolean]
    | ["<", string, string | number | boolean]
    | ["<=", string, string | number | boolean]
    | Array<string | FilterSpecification>;

export type ExpressionSpecification = [string, ...any[]];

export function IsExpressionSpecification(value: any): value is ExpressionSpecification {
    return Array.isArray(value) && typeof value[0] === "string";
}

export type PropertyValueSpecification<T> = T | ExpressionSpecification;

export type ColorSpecification = string;

export type ResolvedImageSpecification = string;

export interface IVectorStyle {
    layers: Record<string, IVectorLayerStyle>;
}

export enum LayerStyleTypes {
    Fill = "fill",
    Line = "line",
    Background = "background",
}

export interface IPaintStyle {}

export interface ILayoutStyle {
    visibility?: "visible" | "none" | ExpressionSpecification;
}

export interface IVectorLayerStyle {
    id?: string | number;
    type: LayerStyleTypes;
    "source-layer": string; // this is used to bind the style with a specific source layer
    minzoom?: number;
    maxzoom?: number;
    slot?: string; // use as grouping layer to ordering the layer.
    filter?: FilterFunc<IVectorTileFeature> | FilterSpecification; // this is used to filter the features that will be rendered
    layout?: ILayoutStyle;
    paint?: IPaintStyle;
}

export interface IFillLayerStyle extends IVectorLayerStyle {
    type: LayerStyleTypes.Fill;
    paint?: IFillPaintStyle;
}

export function IsFillLayerStyle(value: any): value is IFillLayerStyle {
    return value && value.type === LayerStyleTypes.Fill;
}

export interface ILineLayerStyle extends IVectorLayerStyle {
    type: LayerStyleTypes.Line;
    paint?: ILinePaintStyle;
}

export function IsLineLayerStyle(value: any): value is IFillLayerStyle {
    return value && value.type === LayerStyleTypes.Line;
}

// Renders filled polygons.
export interface IFillPaintStyle extends IPaintStyle {
    [key: string]:
        | PropertyValueSpecification<number>
        | PropertyValueSpecification<ColorSpecification>
        | PropertyValueSpecification<ResolvedImageSpecification>
        | PropertyValueSpecification<[number, number]>
        | undefined;
    "fill-opacity"?: PropertyValueSpecification<number>;
    "fill-color"?: PropertyValueSpecification<ColorSpecification>;
    "fill-outline-color"?: PropertyValueSpecification<ColorSpecification>; // this is a shorcut to outline a polygon withoiut the need of defining a line layer
    "fill-pattern"?: PropertyValueSpecification<ResolvedImageSpecification>;
    "fill-translate"?: PropertyValueSpecification<[number, number]>; // shifts the fill layer content by a specified distance in pixels
}

// Renders lines and outlines of polygons
export interface ILinePaintStyle extends IPaintStyle {
    "line-opacity"?: PropertyValueSpecification<number>;
    "line-color"?: PropertyValueSpecification<ColorSpecification>;
    "line-width"?: PropertyValueSpecification<number>;
    "line-dasharray"?: PropertyValueSpecification<Array<number>>;
    "line-translate"?: PropertyValueSpecification<[number, number]>; // shifts the line layer content by a specified distance in pixels
}
