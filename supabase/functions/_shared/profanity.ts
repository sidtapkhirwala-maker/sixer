export const BLOCKED = [
  "fuck","shit","bitch","asshole","cunt","dick","pussy","cock","piss","whore","slut","bastard",
  "nazi","hitler","nigger","nigga","faggot","retard","tranny",
  "chutiya","bhenchod","madarchod","gandu","randi","lund","gaand","haramzada",
]

export function isProfane(name: string): boolean {
  const n = name.toLowerCase()
    .replace(/0/g,"o").replace(/1/g,"i").replace(/3/g,"e")
    .replace(/4/g,"a").replace(/5/g,"s").replace(/\s+/g,"")
  return BLOCKED.some(t => n.includes(t))
}
