
export type Company = {
    name: string;
    type: string;
    children: Company[];
    staff: number;
    salary: number;
    yearsExperience: number;
    radiusVar: number;
    title?: string;
}

export type ForceHierarchyNode<T> = d3.HierarchyNode<T> & {
    data: Company;
    x?: number;
    y?: number;
    vx?: number;
    vy?: number;
    fx?: number;
    fy?: number;
    _children?: ForceHierarchyNode<Company>[] | undefined;
    expanded?: boolean;
};

export type ForceHierarchyLink = {
    source: ForceHierarchyNode<Company>;
    target: ForceHierarchyNode<Company>;
}
