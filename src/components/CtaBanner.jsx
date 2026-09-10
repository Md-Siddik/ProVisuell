import React from "react"
import { OPEN_ORDER_EVENT } from "./StartOrderModal"
import EditableText from "../dashboard/editor/EditableText"

const ArrowIcon = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className="h-[22px] w-[22px]"
  >
    <path
      d="M5 12H19M19 12L14.5 7.5M19 12L14.5 16.5"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
)

const CtaBanner = () => {
  return (
    <section className="w-full bg-[#ff4b00] text-white">
      <div className="mx-auto grid min-h-[158px] w-full max-w-[1760px] grid-cols-[1.65fr_1fr] items-center px-[18px] py-[28px] sm:px-[22px] md:px-[28px] lg:px-[32px] xl:px-[40px] max-md:grid-cols-1 max-md:gap-[28px] max-md:py-[38px]">
        <div>
          <p className="mb-[14px] text-[13px] font-[800] uppercase leading-none tracking-[0.01em] text-white">
            <EditableText k="ctaBanner.eyebrow" />
          </p>

          <h2 className="max-w-[610px] text-[39px] font-[800] leading-[1.04] tracking-[-0.025em] text-white lg:text-[42px] xl:text-[44px] max-md:text-[34px]">
            <EditableText k="ctaBanner.title" />
          </h2>
        </div>

        <div className="flex flex-col items-start justify-center pl-[22px] max-md:pl-0">
          <p className="mb-[17px] max-w-[340px] text-[15px] font-[500] leading-[1.35] text-white lg:text-[16px]">
            <EditableText k="ctaBanner.description" />
          </p>

          <button
            type="button"
            onClick={() => window.dispatchEvent(new Event(OPEN_ORDER_EVENT))}
            className="group flex h-[44px] min-w-[194px] items-center justify-between bg-[#111111] px-[25px] text-[13px] font-[800] uppercase tracking-[0.01em] text-white transition-colors duration-300 hover:bg-black"
          >
            <span><EditableText k="ctaBanner.ctaButton" /></span>

            <span className="ml-[26px] transition-transform duration-300 group-hover:translate-x-[4px]">
              <ArrowIcon />
            </span>
          </button>
        </div>
      </div>
    </section>
  )
}

export default CtaBanner