"use client";

import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import clsx from "clsx";
import { useTaskActions } from "@/lib/client/hooks";
import type { Task } from "@/lib/shared/types";
import { TaskRow } from "../TaskRow";

type RowProps = Omit<React.ComponentProps<typeof TaskRow>, "dragHandle">;

const byPriority = (a: Task, b: Task) => a.priority - b.priority || a.sort_order - b.sort_order || a.id - b.id;

function SortableRow({ props }: { props: RowProps }) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id: props.task.id });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={clsx("relative", isDragging && "z-10 opacity-90 shadow-card")}
    >
      <TaskRow {...props} dragHandle={{ ...attributes, ...listeners, ref: setActivatorNodeRef }} />
    </div>
  );
}

/** Tasks sorted by priority; dragging across priorities adopts the neighbour's priority. */
export function SortableTaskGroup({ tasks, rowProps }: { tasks: Task[]; rowProps: (t: Task) => RowProps }) {
  const { reorder, update } = useTaskActions();
  const sorted = [...tasks].sort(byPriority);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 120, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function onDragEnd({ active, over }: DragEndEvent) {
    if (!over || active.id === over.id) return;
    const from = sorted.findIndex((t) => t.id === active.id);
    const to = sorted.findIndex((t) => t.id === over.id);
    const moved = arrayMove(sorted, from, to);
    const neighbour = moved[to - 1] ?? moved[to + 1];
    const task = moved[to];
    if (neighbour && neighbour.priority !== task.priority) {
      moved[to] = { ...task, priority: neighbour.priority };
      update(task, { priority: neighbour.priority });
    }
    reorder(moved);
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
      <SortableContext items={sorted.map((t) => t.id)} strategy={verticalListSortingStrategy}>
        <div className="space-y-2">
          {sorted.map((t) => (
            <SortableRow key={t.id} props={rowProps(t)} />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}
