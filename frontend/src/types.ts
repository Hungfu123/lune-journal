export type Theme = 'sunset' | 'ocean' | 'night' | 'wald' | 'lavendel' | 'zitrone' | 'polaroid' | 'kino' | 'retro' | 'bonbon' | 'tiefsee'

export interface Me {
  id: number
  name: string
  email: string
  theme: Theme
  reminder: { enabled: boolean; weekday: number; hour: number }
  ask_place: boolean
  partner: { id: number; name: string } | null
}

export interface Photo {
  id: string
  thumb: string
  src: string
  print: string
  width: number
  height: number
  taken_at: string | null
  place_name: string | null
  has_location: boolean
}

export interface Entry {
  id: number
  date: string
  kind: 'short' | 'long'
  title: string
  text: string
  mood: string
  energy: number | null
  created_at: string
  author: { id: number; name: string }
  mine: boolean
  photos: Photo[]
  place_name: string | null
  comments: number
  hearts: number
  hearted: boolean
}

export interface Question {
  id: number
  text: string
  both: boolean
  asker: { id: number; name: string }
  mine: boolean
  created_at: string
  complete: boolean
  completed_at: string | null
  open_for_me: boolean
  waiting_on: string[]
  answers: { user: { id: number; name: string }; text: string }[]
}

export interface Comment {
  id: number
  text: string
  created_at: string
  author: { id: number; name: string }
  mine: boolean
}
