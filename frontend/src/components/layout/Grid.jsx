import React from 'react'
import { cn } from '../../utils'

const Grid = React.forwardRef(({ 
  className, 
  children, 
  cols = 3,
  gap = 6,
  ...props 
}, ref) => {
  const gridClasses = {
    1: 'grid-cols-1',
    2: 'grid-cols-1 md:grid-cols-2',
    3: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3',
    4: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-4',
    6: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6'
  }

  const gapClasses = {
    2: 'gap-2',
    4: 'gap-4',
    6: 'gap-6',
    8: 'gap-8'
  }

  return (
    <div
      ref={ref}
      className={cn(
        'grid',
        gridClasses[cols],
        gapClasses[gap],
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
})

Grid.displayName = 'Grid'

export { Grid }
