import { Drawer } from 'vaul'
import { useSheetDirection } from '../useMedia'
import MonthGrid from './MonthGrid'

interface Props {
  open: boolean
  onOpenChange: (o: boolean) => void
  current: string
  onPick: (key: string) => void
}

export default function MonthSheet({ open, onOpenChange, current, onPick }: Props) {
  const direction = useSheetDirection()
  return (
    <Drawer.Root closeThreshold={0.4} open={open} onOpenChange={onOpenChange} direction={direction}>
      <Drawer.Portal>
        <Drawer.Overlay className="sheet-overlay" />
        <Drawer.Content className="sheet" aria-describedby={undefined}>
          <Drawer.Handle className="sheet-handle" preventCycle />
          <div data-vaul-no-drag>
          <MonthGrid
            current={current}
            active={open}
            title={<Drawer.Title className="sheet-title">Springe zu</Drawer.Title>}
            onPick={(k) => {
              onPick(k)
              onOpenChange(false)
            }}
          />
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  )
}
