import { useMemo, useEffect, useRef, useState } from 'react'
import { useQueries, useQuery } from '@tanstack/react-query'
import {
  ReactFlow,
  Background,
  Controls,
  BackgroundVariant,
  Position,
  Handle,
  useReactFlow,
  ReactFlowProvider,
} from '@xyflow/react'
import type { Node, Edge } from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { api } from '@/api'
import type { Task } from '@/api'
import { cn } from '@/lib/utils'
import FlowingEdge from './FlowingEdge'

// 3 状态系统（与后端一致）
const STATUS_CONFIG: Record<string, { label: string; emoji: string; color: string }> = {
  planned: { label: '待办', emoji: '📋', color: '#8b949e' },
  in_progress: { label: '进行中', emoji: '🔄', color: '#d29922' },
  done: { label: '完成', emoji: '✅', color: '#3fb950' },
}

// Check if a task is "inserted" (created after version was locked)
function isInsertedTask(task: Task, lockedAt: string | null): boolean {
  if (!lockedAt) return false
  
  const taskCreatedAt = new Date(task.created_at).getTime()
  const versionLockedAt = new Date(lockedAt).getTime()
  
  // Task is considered "inserted" if created after the version was locked
  return taskCreatedAt > versionLockedAt
}

// Custom node component for tasks
interface TaskNodeData {
  label: string
  status: string
  isInserted: boolean
  isSubtask: boolean
  emoji: string
  statusColor: string
  expectedEndDate: string | null  // Calculated expected completion date
  actualEnd: string | null  // Actual completion date for done tasks
}

// Format date for display (MM/DD)
function formatDate(dateStr: string | null): string | null {
  if (!dateStr) return null
  const date = new Date(dateStr)
  return `${date.getMonth() + 1}/${date.getDate()}`
}

function TaskNode({ data }: { data: TaskNodeData }) {
  const { label, status, isInserted, isSubtask, emoji, statusColor, expectedEndDate, actualEnd } = data
  const isDone = status === 'done'
  const isInProgress = status === 'in_progress'
  
  // For done tasks, show actual completion date; otherwise show expected date
  const displayDate = isDone && actualEnd ? actualEnd : expectedEndDate
  const formattedDate = formatDate(displayDate)
  const dateLabel = isDone && actualEnd ? '完成' : '预计'
  
  return (
    <div
      className={cn(
        'relative rounded-lg border-2 border-solid bg-card px-3 py-2 text-sm',
        isSubtask ? 'w-48 rounded-md border text-xs' : 'w-60',
        isInserted && 'border-dashed',
        isDone && 'opacity-80',
      )}
      style={{
        borderColor: isInserted ? '#f85149' : statusColor,
        borderWidth: isInserted ? 2 : (isSubtask ? 1 : 2),
        borderStyle: isInserted ? 'dashed' : 'solid',
      }}
    >
      {/* Handles for main tasks (horizontal connection) */}
      {!isSubtask && (
        <>
          <Handle type="target" position={Position.Left} id="left" />
          <Handle type="source" position={Position.Right} id="right" />
          <Handle type="source" position={Position.Bottom} id="bottom" />
        </>
      )}
      {/* Handles for subtasks (vertical connection) */}
      {isSubtask && (
        <>
          <Handle type="target" position={Position.Top} id="top" />
          <Handle type="source" position={Position.Bottom} id="bottom" />
        </>
      )}
      
      {/* Date label above main tasks */}
      {!isSubtask && formattedDate && (
        <div className={cn(
          'absolute -top-5 left-1/2 -translate-x-1/2 whitespace-nowrap rounded bg-secondary px-1.5 py-0.5 text-[10px] text-muted-foreground',
          isDone && 'text-success',
        )}>
          {dateLabel} {formattedDate}
        </div>
      )}
      
      {/* Sparkle effects for done tasks */}
      {isDone && !isSubtask && (
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <span className="sparkle sparkle-1 absolute left-2 top-0 text-xs text-success animate-pulse">✦</span>
          <span className="sparkle sparkle-2 absolute right-3 top-1 text-xs text-success animate-pulse delay-300">✦</span>
          <span className="sparkle sparkle-3 absolute bottom-0 right-1 text-xs text-success animate-pulse delay-500">✦</span>
        </div>
      )}
      
      <div className="flex items-center gap-1.5">
        <span className="text-sm">{emoji}</span>
        <span className={cn(
          'truncate',
          isDone && 'line-through text-muted-foreground',
        )}>
          {label}
        </span>
        {isDone && <span className="ml-auto text-xs font-bold text-success">✓</span>}
        {isInProgress && <span className="ml-auto text-xs text-warning animate-pulse">●</span>}
        {isInserted && <span className="ml-auto rounded bg-destructive/20 px-1 py-0.5 text-[10px] font-medium text-destructive">插队</span>}
      </div>
    </div>
  )
}

const nodeTypes = {
  taskNode: TaskNode,
}

const edgeTypes = {
  flowing: FlowingEdge,
}

// Task with children from API
interface TaskWithChildren extends Task {
  children?: TaskWithChildren[]
}

// Layout constants
const MAIN_Y = 60
const MAIN_X_START = 80
const MAIN_X_GAP = 340
const SUBTASK_Y_START = 160
const SUBTASK_Y_GAP = 60

// Manual layout: main tasks horizontal at top, subtasks branch downward
function buildFlowElements(
  tasksWithChildren: TaskWithChildren[],
  expectedEndDates: Map<string, string>,
  lockedAt: string | null
): { nodes: Node[]; edges: Edge[] } {
  const nodes: Node[] = []
  const edges: Edge[] = []
  
  const sortedTasks = [...tasksWithChildren].sort((a, b) => a.sort_order - b.sort_order)
  
  sortedTasks.forEach((task, index) => {
    const statusConfig = STATUS_CONFIG[task.status] || STATUS_CONFIG.planned
    const isInserted = isInsertedTask(task, lockedAt)
    const mainX = MAIN_X_START + index * MAIN_X_GAP
    
    // Create main task node
    nodes.push({
      id: task.id,
      type: 'taskNode',
      position: { x: mainX, y: MAIN_Y },
      data: {
        label: task.title,
        status: task.status,
        isInserted,
        isSubtask: false,
        emoji: statusConfig.emoji,
        statusColor: statusConfig.color,
        expectedEndDate: expectedEndDates.get(task.id) || null,
        actualEnd: task.actual_end || null,
      },
    })
    
    // Connect to previous main task (horizontal arrow)
    if (index > 0) {
      const prevTask = sortedTasks[index - 1]
      edges.push({
        id: `e-main-${prevTask.id}-${task.id}`,
        source: prevTask.id,
        target: task.id,
        sourceHandle: 'right',
        targetHandle: 'left',
        type: 'flowing',
        data: {
          isInserted,
          sourceStatus: prevTask.status,
          targetStatus: task.status,
        },
        markerEnd: { type: 'arrowclosed' as const, color: isInserted ? '#f85149' : '#58a6ff' },
      })
    }
    
    // Process subtasks - vertical stack below parent
    if (task.children && task.children.length > 0) {
      const sortedChildren = [...task.children].sort((a, b) => a.sort_order - b.sort_order)
      
      sortedChildren.forEach((child, childIndex) => {
        const childStatusConfig = STATUS_CONFIG[child.status] || STATUS_CONFIG.planned
        const isChildInserted = isInsertedTask(child, lockedAt)
        const childX = mainX  // Align with parent for vertical connection line
        const childY = SUBTASK_Y_START + childIndex * SUBTASK_Y_GAP
        
        nodes.push({
          id: child.id,
          type: 'taskNode',
          position: { x: childX, y: childY },
          data: {
            label: child.title,
            status: child.status,
            isInserted: isChildInserted,
            isSubtask: true,
            emoji: childStatusConfig.emoji,
            statusColor: childStatusConfig.color,
            expectedEndDate: null,  // Subtasks don't show expected date
            actualEnd: child.actual_end || null,
          },
        })
        
        // Connect: first child to parent, others to previous sibling
        if (childIndex === 0) {
          // Parent -> first child
          edges.push({
            id: `e-parent-${task.id}-${child.id}`,
            source: task.id,
            target: child.id,
            sourceHandle: 'bottom',
            targetHandle: 'top',
            type: 'flowing',
            data: {
              isInserted: isChildInserted,
              sourceStatus: task.status,
              targetStatus: child.status,
            },
          })
        } else {
          // Previous sibling -> current child
          const prevChild = sortedChildren[childIndex - 1]
          edges.push({
            id: `e-sibling-${prevChild.id}-${child.id}`,
            source: prevChild.id,
            target: child.id,
            sourceHandle: 'bottom',
            targetHandle: 'top',
            type: 'flowing',
            data: {
              isInserted: isChildInserted,
              sourceStatus: prevChild.status,
              targetStatus: child.status,
            },
          })
        }
      })
    }
  })
  
  return { nodes, edges }
}

interface FlowViewProps {
  tasks: Task[]
  lockedAt?: string | null
}

// Find the task to focus on: first in_progress, or first todo (next task)
function findFocusTaskIndex(tasks: TaskWithChildren[]): number {
  const sortedTasks = [...tasks].sort((a, b) => a.sort_order - b.sort_order)
  
  // First, find in_progress task
  const inProgressIndex = sortedTasks.findIndex(t => t.status === 'in_progress')
  if (inProgressIndex >= 0) return inProgressIndex
  
  // Then, find first planned task (next task to do)
  const todoIndex = sortedTasks.findIndex(t => t.status === 'planned')
  if (todoIndex >= 0) return todoIndex
  
  // If all done, focus on last task
  return sortedTasks.length - 1
}

// Inner component that can use useReactFlow hook
function FlowViewInner({ 
  nodes, 
  focusTaskIndex,
  isInitialMount 
}: { 
  nodes: Node[]
  focusTaskIndex: number
  isInitialMount: boolean
}) {
  const { setCenter, fitView } = useReactFlow()
  const hasInitialized = useRef(false)
  
  // Focus on target task only on initial mount
  useEffect(() => {
    if (hasInitialized.current || !isInitialMount) return
    if (nodes.length === 0) return
    
    // Small delay to ensure ReactFlow is ready
    const timer = setTimeout(() => {
      if (focusTaskIndex >= 0 && focusTaskIndex < nodes.length) {
        // Find the main task node (not subtask)
        const mainNodes = nodes.filter(n => !n.data.isSubtask)
        const targetNode = mainNodes[focusTaskIndex]
        
        if (targetNode) {
          // Center horizontally on the target node, position vertically near top
          // setCenter puts the coordinate at viewport center, so we offset Y downward
          // to make the task appear in the upper portion of the view
          setCenter(
            targetNode.position.x + 120, // Horizontal center of node (half of node width ~240)
            targetNode.position.y + 180, // Offset down so task appears near top of viewport
            { zoom: 1.0, duration: 600 }
          )
        }
      } else {
        // Fallback to fitView if no specific task to focus
        fitView({ padding: 0.3, duration: 600 })
      }
      hasInitialized.current = true
    }, 100)
    
    return () => clearTimeout(timer)
  }, [nodes, focusTaskIndex, setCenter, fitView, isInitialMount])
  
  return (
    <>
      <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="#30363d" />
      <Controls showInteractive={false} />
    </>
  )
}

export default function FlowView({ tasks, lockedAt = null }: FlowViewProps) {
  // Track initial mount state for focusing logic
  // Using state initialized to true, then set to false after first render via effect
  const [isInitialMount, setIsInitialMount] = useState(() => true)
  
  // Fetch full details (with children) for each task
  const taskQueries = useQueries({
    queries: tasks.map(task => ({
      queryKey: ['task', task.id],
      queryFn: () => api.getTask(task.id),
    })),
  })
  
  const isLoading = taskQueries.some(q => q.isLoading)
  const isError = taskQueries.some(q => q.isError)
  const tasksWithChildren = taskQueries
    .map(q => q.data)
    .filter((t): t is TaskWithChildren => t !== undefined)
  
  // Sort tasks for API call
  const sortedTasks = useMemo(() => 
    [...tasksWithChildren].sort((a, b) => a.sort_order - b.sort_order), 
    [tasksWithChildren]
  )
  
  // Calculate expected end dates using backend API (considers holidays)
  const { data: endDatesData } = useQuery({
    queryKey: ['calculateEndDates', 'flow', sortedTasks.map(t => `${t.id}-${t.estimated_days}-${t.status}-${t.actual_end}`)],
    queryFn: () => api.calculateEndDates(sortedTasks.map(t => ({
      id: t.id,
      estimated_days: t.estimated_days,
      status: t.status,
      actual_end: t.actual_end,
    }))),
    enabled: sortedTasks.length > 0,
  })
  
  const expectedEndDates = useMemo(() => {
    const result = new Map<string, string>()
    if (endDatesData) {
      for (const item of endDatesData) {
        result.set(item.id, item.endDate)
      }
    }
    return result
  }, [endDatesData])
  
  // Build flow elements
  const { nodes, edges } = useMemo(() => {
    if (tasksWithChildren.length === 0) {
      return { nodes: [], edges: [] }
    }
    return buildFlowElements(tasksWithChildren, expectedEndDates, lockedAt)
  }, [tasksWithChildren, expectedEndDates, lockedAt])
  
  // Find the task to focus on
  const focusTaskIndex = useMemo(() => {
    if (sortedTasks.length === 0) return -1
    return findFocusTaskIndex(sortedTasks)
  }, [sortedTasks])
  
  // After first render, mark as no longer initial mount
  // This is syncing React state with the DOM lifecycle (initial vs re-render)
  useEffect(() => {
    setIsInitialMount(false) // eslint-disable-line react-hooks/set-state-in-effect
  }, [])
  
  if (tasks.length === 0) {
    return <div className="rounded-lg border border-border bg-card p-4 text-foreground">暂无任务</div>
  }
  
  if (isLoading) {
    return <div className="rounded-lg border border-border bg-card p-4 text-foreground">加载中...</div>
  }

  if (isError) {
    return <div className="rounded-lg border border-destructive/20 bg-destructive/10 p-4 text-destructive">任务详情加载失败</div>
  }

  if (nodes.length === 0) {
    return <div className="rounded-lg border border-border bg-card p-4 text-foreground">暂无可展示的任务</div>
  }
  
  return (
    <div className="relative h-full min-h-0 w-full overflow-hidden">
      <ReactFlowProvider>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          fitView={false}
          defaultViewport={{ x: 0, y: 0, zoom: 1 }}
          minZoom={0.3}
          maxZoom={1.5}
          nodesDraggable={false}
          nodesConnectable={false}
          elementsSelectable={false}
          panOnScroll
          zoomOnScroll
          proOptions={{ hideAttribution: true }}
          className="dark"
        >
          <FlowViewInner 
            nodes={nodes} 
            focusTaskIndex={focusTaskIndex}
            isInitialMount={isInitialMount}
          />
        </ReactFlow>
      </ReactFlowProvider>
      
      {/* Legend */}
      <div className="absolute bottom-4 left-4 z-10 flex items-center gap-4 rounded-lg border border-border bg-card/90 px-3 py-2 backdrop-blur-sm">
        <div className="flex items-center gap-1.5 text-xs text-foreground">
          <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: '#3fb950' }}></span>
          <span>已完成</span>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-foreground">
          <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: '#d29922' }}></span>
          <span>进行中</span>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-foreground">
          <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: '#8b949e' }}></span>
          <span>待办</span>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-foreground">
          <span className="inline-block h-2.5 w-2.5 rounded-full border border-dashed border-destructive" style={{ backgroundColor: 'transparent' }}></span>
          <span>插队任务</span>
        </div>
      </div>
    </div>
  )
}
