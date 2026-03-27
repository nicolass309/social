'use client';

import { useState } from 'react';
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  addDays,
  addMonths,
  subMonths,
  isSameMonth,
  isSameDay,
  isToday,
} from 'date-fns';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';


interface ScheduledPost {
  id: string;
  title: string;
  platforms: string[];
  scheduledAt: string;
}

interface ScheduleCalendarProps {
  posts: ScheduledPost[];
  onPostClick?: (post: ScheduledPost) => void;
}

export function ScheduleCalendar({ posts, onPostClick }: ScheduleCalendarProps) {
  const [currentMonth, setCurrentMonth] = useState(new Date());

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(monthStart);
  const calStart = startOfWeek(monthStart);
  const calEnd = endOfWeek(monthEnd);

  const days: Date[] = [];
  let day = calStart;
  while (day <= calEnd) {
    days.push(day);
    day = addDays(day, 1);
  }

  const weeks: Date[][] = [];
  for (let i = 0; i < days.length; i += 7) {
    weeks.push(days.slice(i, i + 7));
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="flex items-center justify-between p-4 border-b border-gray-200">
        <Button variant="ghost" size="icon" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <h2 className="font-semibold text-gray-900">{format(currentMonth, 'MMMM yyyy')}</h2>
        <Button variant="ghost" size="icon" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      <div className="grid grid-cols-7">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
          <div key={d} className="p-2 text-center text-xs font-medium text-gray-500 border-b border-gray-100">
            {d}
          </div>
        ))}

        {weeks.map((week, wi) =>
          week.map((day, di) => {
            const dayPosts = posts.filter(
              (p) => p.scheduledAt && isSameDay(new Date(p.scheduledAt), day)
            );
            return (
              <div
                key={`${wi}-${di}`}
                className={`min-h-[100px] p-1.5 border-b border-r border-gray-100 ${
                  !isSameMonth(day, monthStart) ? 'bg-gray-50' : ''
                }`}
              >
                <span
                  className={`text-xs font-medium ${
                    isToday(day)
                      ? 'bg-indigo-500 text-white rounded-full w-6 h-6 flex items-center justify-center'
                      : !isSameMonth(day, monthStart)
                      ? 'text-gray-300'
                      : 'text-gray-700'
                  }`}
                >
                  {format(day, 'd')}
                </span>
                <div className="mt-1 space-y-1">
                  {dayPosts.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => onPostClick?.(p)}
                      className="w-full text-left rounded px-1.5 py-0.5 bg-indigo-50 hover:bg-indigo-100 transition-colors"
                    >
                      <p className="text-xs font-medium text-indigo-700 truncate">{p.title}</p>
                      <p className="text-[10px] text-indigo-500">
                        {format(new Date(p.scheduledAt), 'HH:mm')}
                      </p>
                    </button>
                  ))}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
