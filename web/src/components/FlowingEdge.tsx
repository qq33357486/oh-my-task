import { getSmoothStepPath } from '@xyflow/react'
import type { EdgeProps } from '@xyflow/react'

export interface FlowingEdgeData {
  isInserted?: boolean
  sourceStatus?: string
  targetStatus?: string
  [key: string]: unknown
}

// Custom edge with flowing light effect
export default function FlowingEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
}: EdgeProps) {
  // Adjust target position to account for arrow marker
  const [edgePath] = getSmoothStepPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
    offset: 0,  // Remove default 20px offset to connect directly to handles
  })

  const edgeData = data as FlowingEdgeData | undefined
  const isInserted = edgeData?.isInserted ?? false
  const sourceStatus = edgeData?.sourceStatus ?? 'todo'
  
  // Determine if this edge should have flowing animation
  const shouldFlow = sourceStatus === 'done' || sourceStatus === 'in_progress' || sourceStatus === 'review'
  
  // Base line color
  const baseColor = isInserted ? '#f85149' : '#58a6ff'
  
  // Flow color based on source status
  const getFlowColor = () => {
    if (isInserted) return '#f85149'
    if (sourceStatus === 'done') return '#3fb950'
    if (sourceStatus === 'in_progress') return '#d29922'
    if (sourceStatus === 'review') return '#a371f7'
    return '#58a6ff'
  }
  
  const flowColor = getFlowColor()
  const gradientId = `flow-gradient-${id}`
  const filterId = `flow-glow-${id}`
  const markerId = `arrow-marker-${id}`

  return (
    <g className="react-flow__edge">
      <defs>
        {/* Arrow marker - properly sized and positioned */}
        <marker
          id={markerId}
          markerWidth="8"
          markerHeight="8"
          refX="8"
          refY="4"
          orient="auto"
          markerUnits="strokeWidth"
        >
          <path
            d="M0,0 L8,4 L0,8 L2,4 Z"
            fill={baseColor}
          />
        </marker>
        
        {/* Glow filter for the flowing dot */}
        <filter id={filterId} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        
        {/* Gradient for trail effect */}
        <linearGradient id={gradientId} gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor={flowColor} stopOpacity="0" />
          <stop offset="70%" stopColor={flowColor} stopOpacity="0.6" />
          <stop offset="100%" stopColor={flowColor} stopOpacity="1" />
        </linearGradient>
      </defs>
      
      {/* Base edge line - ALWAYS visible with arrow */}
      <path
        d={edgePath}
        fill="none"
        stroke={baseColor}
        strokeWidth={2}
        strokeDasharray={isInserted ? '5,5' : undefined}
        markerEnd={`url(#${markerId})`}
        className="react-flow__edge-path"
      />
      
      {/* Flowing light effect - only show if should flow */}
      {shouldFlow && (
        <>
          {/* Trail effect */}
          <path
            d={edgePath}
            fill="none"
            stroke={`url(#${gradientId})`}
            strokeWidth="4"
            strokeLinecap="round"
            className="flowing-trail"
            style={{ filter: `url(#${filterId})` }}
          >
            <animate
              attributeName="stroke-dasharray"
              values="0 1000;60 1000;0 1000"
              dur="2.5s"
              repeatCount="indefinite"
            />
            <animate
              attributeName="stroke-dashoffset"
              values="0;-120;-240"
              dur="2.5s"
              repeatCount="indefinite"
            />
          </path>
          
          {/* Main flowing dot */}
          <circle r="4" fill={flowColor} filter={`url(#${filterId})`}>
            <animateMotion dur="2.5s" repeatCount="indefinite" path={edgePath} />
          </circle>
          
          {/* Secondary smaller dot (trailing) */}
          <circle r="2.5" fill={flowColor} opacity="0.7">
            <animateMotion dur="2.5s" repeatCount="indefinite" path={edgePath} begin="-0.15s" />
          </circle>
          
          {/* Third dot (more trailing) */}
          <circle r="1.5" fill={flowColor} opacity="0.4">
            <animateMotion dur="2.5s" repeatCount="indefinite" path={edgePath} begin="-0.3s" />
          </circle>
        </>
      )}
    </g>
  )
}
