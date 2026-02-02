import { useState, useMemo, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { modelenceQuery } from '@modelence/react-query';
import { cn } from '@/client/lib/utils';

type HeatmapData = {
  year: number;
  activities: Record<string, {
    sessionCount: number;
    totalMinutes: number;
    completedSessions: number;
  }>;
};

type DayCell = {
  date: string;
  dayOfWeek: number;
  weekIndex: number;
  sessionCount: number;
  totalMinutes: number;
  level: 0 | 1 | 2 | 3 | 4;
};

const DAYS_OF_WEEK = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function getIntensityLevel(sessionCount: number): 0 | 1 | 2 | 3 | 4 {
  if (sessionCount === 0) return 0;
  if (sessionCount === 1) return 1;
  if (sessionCount <= 3) return 2;
  if (sessionCount <= 5) return 3;
  return 4;
}

function generateYearDays(year: number, activities: HeatmapData['activities']): DayCell[] {
  const days: DayCell[] = [];
  const startDate = new Date(year, 0, 1);
  const endDate = new Date(year, 11, 31);

  // Find the first Sunday on or before the start date
  const firstDay = new Date(startDate);
  firstDay.setDate(firstDay.getDate() - firstDay.getDay());

  let currentDate = new Date(firstDay);
  let weekIndex = 0;

  while (currentDate <= endDate || currentDate.getDay() !== 0) {
    const dateStr = currentDate.toISOString().split('T')[0];
    const isInYear = currentDate.getFullYear() === year;
    const activity = activities[dateStr];

    days.push({
      date: dateStr,
      dayOfWeek: currentDate.getDay(),
      weekIndex,
      sessionCount: isInYear ? (activity?.sessionCount || 0) : 0,
      totalMinutes: isInYear ? (activity?.totalMinutes || 0) : 0,
      level: isInYear ? getIntensityLevel(activity?.sessionCount || 0) : 0,
    });

    currentDate.setDate(currentDate.getDate() + 1);
    if (currentDate.getDay() === 0) {
      weekIndex++;
    }
  }

  return days;
}

function getMonthLabels(year: number): { month: string; weekIndex: number }[] {
  const labels: { month: string; weekIndex: number }[] = [];

  for (let month = 0; month < 12; month++) {
    const firstOfMonth = new Date(year, month, 1);
    const startDate = new Date(year, 0, 1);
    startDate.setDate(startDate.getDate() - startDate.getDay());

    const diffTime = firstOfMonth.getTime() - startDate.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    const weekIndex = Math.floor(diffDays / 7);

    labels.push({ month: MONTHS[month], weekIndex });
  }

  return labels;
}

interface FocusHeatmapProps {
  className?: string;
}

export default function FocusHeatmap({ className }: FocusHeatmapProps) {
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [hoveredDay, setHoveredDay] = useState<DayCell | null>(null);
  const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 });

  const { data, isLoading } = useQuery({
    ...modelenceQuery<HeatmapData>('focus.getFocusHeatmap', { year: selectedYear }),
  });

  const days = useMemo(() => {
    if (!data) return [];
    return generateYearDays(selectedYear, data.activities);
  }, [data, selectedYear]);

  const monthLabels = useMemo(() => getMonthLabels(selectedYear), [selectedYear]);

  const totalSessions = useMemo(() => {
    if (!data) return 0;
    return Object.values(data.activities).reduce((sum, a) => sum + a.sessionCount, 0);
  }, [data]);

  const totalMinutes = useMemo(() => {
    if (!data) return 0;
    return Object.values(data.activities).reduce((sum, a) => sum + a.totalMinutes, 0);
  }, [data]);

  const handleMouseEnter = useCallback((day: DayCell, e: React.MouseEvent) => {
    const rect = (e.target as HTMLElement).getBoundingClientRect();
    setHoveredDay(day);
    setTooltipPosition({
      x: rect.left + rect.width / 2,
      y: rect.top - 8,
    });
  }, []);

  const handleMouseLeave = useCallback(() => {
    setHoveredDay(null);
  }, []);

  const formatDate = useCallback((dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  }, []);

  const maxWeeks = days.length > 0 ? Math.max(...days.map(d => d.weekIndex)) + 1 : 53;

  if (isLoading) {
    return (
      <div className={cn("animate-pulse", className)}>
        <div className="h-32 bg-white/5 rounded-lg" />
      </div>
    );
  }

  return (
    <div className={cn("space-y-4", className)}>
      {/* Year selector and stats */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setSelectedYear(y => y - 1)}
            disabled={selectedYear <= 2020}
            className="p-1.5 rounded-lg hover:bg-white/10 text-white/50 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <span className="text-sm font-medium text-white min-w-[60px] text-center">{selectedYear}</span>
          <button
            onClick={() => setSelectedYear(y => y + 1)}
            disabled={selectedYear >= currentYear}
            className="p-1.5 rounded-lg hover:bg-white/10 text-white/50 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
        <div className="flex items-center gap-4 text-sm text-white/50">
          <span>{totalSessions} sessions</span>
          <span>{Math.floor(totalMinutes / 60)}h {totalMinutes % 60}m focused</span>
        </div>
      </div>

      {/* Heatmap */}
      <div className="overflow-x-auto pb-2">
        <div className="min-w-[700px]">
          {/* Month labels row */}
          <div className="flex gap-[3px] mb-1 ml-8 relative h-4">
            {monthLabels.map((label, i) => (
              <span
                key={i}
                className="text-[10px] text-white/40 absolute"
                style={{
                  left: `${(label.weekIndex / maxWeeks) * 100}%`,
                }}
              >
                {label.month}
              </span>
            ))}
          </div>

          <div className="relative mt-4">
            <div className="flex">
              {/* Day labels */}
              <div className="flex flex-col gap-[3px] mr-2 text-[10px] text-white/40">
                {DAYS_OF_WEEK.map((day, i) => (
                  <div key={i} className="h-[11px] flex items-center">
                    {i % 2 === 1 ? day : ''}
                  </div>
                ))}
              </div>

              {/* Grid */}
              <div className="flex-1">
                <div
                  className="grid gap-[3px]"
                  style={{
                    gridTemplateColumns: `repeat(${maxWeeks}, 11px)`,
                    gridTemplateRows: 'repeat(7, 11px)',
                  }}
                >
                  {days.map((day, i) => (
                    <div
                      key={i}
                      className={cn(
                        "rounded-sm cursor-pointer transition-colors",
                        day.level === 0 && "bg-white/5",
                        day.level === 1 && "bg-emerald-900/60",
                        day.level === 2 && "bg-emerald-700/70",
                        day.level === 3 && "bg-emerald-500/80",
                        day.level === 4 && "bg-emerald-400",
                        "hover:ring-1 hover:ring-white/30"
                      )}
                      style={{
                        gridRow: day.dayOfWeek + 1,
                        gridColumn: day.weekIndex + 1,
                      }}
                      onMouseEnter={(e) => handleMouseEnter(day, e)}
                      onMouseLeave={handleMouseLeave}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center justify-end gap-2 text-[10px] text-white/40">
        <span>Less</span>
        <div className="flex gap-[3px]">
          <div className="w-[11px] h-[11px] rounded-sm bg-white/5" />
          <div className="w-[11px] h-[11px] rounded-sm bg-emerald-900/60" />
          <div className="w-[11px] h-[11px] rounded-sm bg-emerald-700/70" />
          <div className="w-[11px] h-[11px] rounded-sm bg-emerald-500/80" />
          <div className="w-[11px] h-[11px] rounded-sm bg-emerald-400" />
        </div>
        <span>More</span>
      </div>

      {/* Tooltip */}
      {hoveredDay && (
        <div
          className="fixed z-50 px-2.5 py-1.5 rounded-lg bg-stone-800 border border-white/10 shadow-lg text-sm pointer-events-none"
          style={{
            left: tooltipPosition.x,
            top: tooltipPosition.y,
            transform: 'translate(-50%, -100%)',
          }}
        >
          <div className="font-medium text-white">
            {hoveredDay.sessionCount} {hoveredDay.sessionCount === 1 ? 'session' : 'sessions'}
          </div>
          {hoveredDay.totalMinutes > 0 && (
            <div className="text-white/50 text-xs">
              {hoveredDay.totalMinutes} minutes focused
            </div>
          )}
          <div className="text-white/40 text-xs mt-0.5">
            {formatDate(hoveredDay.date)}
          </div>
        </div>
      )}
    </div>
  );
}
