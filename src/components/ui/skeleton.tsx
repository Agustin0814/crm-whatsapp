import { cn } from "cn"

/**
 * Forma de carga: gris redondeado (token --esqueleto) con un brillo suave que
 * la recorre (.esqueleto en globals.css). Con prefers-reduced-motion queda
 * fija, sin brillo. Es decorativa: el contenedor anuncia la carga.
 */
function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      aria-hidden
      className={cn("esqueleto rounded-md", className)}
      {...props}
    />
  )
}

export { Skeleton }
