import { Head } from '@inertiajs/react';
import ProjectCalendar from '@/components/project-manager/project-calendar';
import type { CalendarEvent } from '@/components/project-manager/project-calendar';
import ProjectManagerLayout from '@/layouts/project-manager-layout';

/** Adviser revision G1: the Calendar page (sent by CalendarController). */
export default function Calendar({ events }: { events: CalendarEvent[] }) {
    return (
        <ProjectManagerLayout>
            <Head title="Calendar" />

            <ProjectCalendar events={events} />
        </ProjectManagerLayout>
    );
}