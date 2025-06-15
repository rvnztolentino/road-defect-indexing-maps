"use client"

import { Menu } from "lucide-react"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import Image from "next/image"

interface HeaderProps {
  onMenuClick?: () => void
}

export function Header({ onMenuClick }: HeaderProps) {
  return (
    <header className="flex items-center justify-between px-2 md:px-4 py-2 bg-black/90 text-white">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" className="md:hidden" onClick={onMenuClick}>
          <Menu className="h-5 w-5" />
          <span className="sr-only">Toggle menu</span>
        </Button>
        <Image src="/logo.png" alt="Road Defect Mapping" width={32} height={32} />
        <h1 className="text-lg font-semibold">Road Defect Mapping</h1>
      </div>
      <div className="flex items-center gap-2">
        <Link href="https://github.com/rvnztolentino/road-defect-indexing-maps" target="_blank" rel="noopener noreferrer">
          <Button variant="outline" size="sm" className="text-xs">
            GitHub
          </Button>
        </Link>
      </div>
    </header>
  )
}
