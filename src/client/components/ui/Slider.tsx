import * as React from "react"
import { cn } from "@/client/lib/utils"

export interface SliderProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
  showValue?: boolean
  formatValue?: (value: number) => string
}

const Slider = React.forwardRef<HTMLInputElement, SliderProps>(
  ({ className, showValue = false, formatValue, value, min = 0, max = 100, ...props }, ref) => {
    const currentValue = typeof value === 'number' ? value : Number(value) || 0
    const percentage = ((currentValue - Number(min)) / (Number(max) - Number(min))) * 100

    return (
      <div className="relative w-full">
        <input
          type="range"
          ref={ref}
          value={value}
          min={min}
          max={max}
          className={cn(
            "w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer",
            "[&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-black [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:transition-transform [&::-webkit-slider-thumb]:hover:scale-110",
            "[&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-black [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:cursor-pointer",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2",
            className
          )}
          style={{
            background: `linear-gradient(to right, #000 0%, #000 ${percentage}%, #e5e7eb ${percentage}%, #e5e7eb 100%)`
          }}
          {...props}
        />
        {showValue && (
          <div className="mt-1 text-sm text-gray-600 text-center">
            {formatValue ? formatValue(currentValue) : currentValue}
          </div>
        )}
      </div>
    )
  }
)
Slider.displayName = "Slider"

export { Slider }
