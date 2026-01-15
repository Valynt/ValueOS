import * as React from 'react';

export type TableElementProps = React.HTMLAttributes<HTMLTableElement>;
export type TableSectionProps = React.HTMLAttributes<HTMLTableSectionElement>;
export type TableRowProps = React.HTMLAttributes<HTMLTableRowElement>;
export type TableCellProps = React.TdHTMLAttributes<HTMLTableCellElement>;
export type TableHeadProps = React.ThHTMLAttributes<HTMLTableCellElement>;

export const Table = ({ children, ...props }: TableElementProps) => <table {...props}>{children}</table>;
export const TableHeader = ({ children, ...props }: TableSectionProps) => <thead {...props}>{children}</thead>;
export const TableBody = ({ children, ...props }: TableSectionProps) => <tbody {...props}>{children}</tbody>;
export const TableRow = ({ children, ...props }: TableRowProps) => <tr {...props}>{children}</tr>;
export const TableHead = ({ children, ...props }: TableHeadProps) => <th {...props}>{children}</th>;
export const TableCell = ({ children, ...props }: TableCellProps) => <td {...props}>{children}</td>;
