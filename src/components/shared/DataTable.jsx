import { useState } from 'react'
import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  useReactTable,
} from '@tanstack/react-table'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { Skeleton } from '@/components/ui/skeleton'
import { ChevronLeft, ChevronRight, ArrowUpDown, Search } from 'lucide-react'

export default function DataTable({
  columns,
  data = [],
  loading = false,
  searchable = false,
  searchPlaceholder = 'Filter...',
  selectable = false,
  onSelectionChange,
  pageSize = 20,
}) {
  const [sorting, setSorting] = useState([])
  const [globalFilter, setGlobalFilter] = useState('')
  const [rowSelection, setRowSelection] = useState({})

  const tableColumns = selectable
    ? [
        {
          id: 'select',
          header: ({ table }) => (
            <Checkbox
              checked={table.getIsAllPageRowsSelected()}
              onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
              aria-label="Select all"
            />
          ),
          cell: ({ row }) => (
            <Checkbox
              checked={row.getIsSelected()}
              onCheckedChange={(value) => row.toggleSelected(!!value)}
              aria-label="Select row"
            />
          ),
          size: 40,
        },
        ...columns,
      ]
    : columns

  const table = useReactTable({
    data,
    columns: tableColumns,
    state: { sorting, globalFilter, rowSelection },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    onRowSelectionChange: (updater) => {
      const next = typeof updater === 'function' ? updater(rowSelection) : updater
      setRowSelection(next)
      if (onSelectionChange) {
        const selectedRows = Object.keys(next)
          .filter((k) => next[k])
          .map((k) => data[parseInt(k)])
        onSelectionChange(selectedRows)
      }
    },
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize } },
  })

  if (loading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full bg-[#111111]" />
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {searchable && (
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#52525B]" />
          <Input
            placeholder={searchPlaceholder}
            value={globalFilter}
            onChange={(e) => setGlobalFilter(e.target.value)}
            className="pl-9 bg-[#0A0A0A] border-[#1a1a1a] text-[#FAFAFA] placeholder:text-[#52525B] h-9 text-sm"
          />
        </div>
      )}

      <div className="rounded-lg border border-[#1a1a1a] overflow-hidden">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id} className="border-[#1a1a1a] hover:bg-transparent">
                {headerGroup.headers.map((header) => (
                  <TableHead
                    key={header.id}
                    className="text-[#52525B] text-xs font-medium uppercase tracking-wider bg-[#0A0A0A] h-10"
                  >
                    {header.isPlaceholder ? null : header.column.getCanSort() ? (
                      <button
                        className="flex items-center gap-1 hover:text-[#A1A1AA] transition-colors"
                        onClick={header.column.getToggleSortingHandler()}
                      >
                        {flexRender(header.column.columnDef.header, header.getContext())}
                        <ArrowUpDown className="w-3 h-3" />
                      </button>
                    ) : (
                      flexRender(header.column.columnDef.header, header.getContext())
                    )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() && 'selected'}
                  className="border-[#1a1a1a] hover:bg-[#111111] transition-colors duration-150 data-[state=selected]:bg-[#3B82F6]/5"
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id} className="text-sm text-[#A1A1AA] py-3">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={tableColumns.length} className="h-24 text-center text-[#52525B]">
                  No results.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {table.getPageCount() > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-[#52525B]">
            {table.getFilteredRowModel().rows.length} row(s)
            {selectable && ` · ${table.getFilteredSelectedRowModel().rows.length} selected`}
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-[#A1A1AA]"
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <span className="text-xs text-[#52525B]">
              {table.getState().pagination.pageIndex + 1} / {table.getPageCount()}
            </span>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-[#A1A1AA]"
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
