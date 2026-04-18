import React from 'react'

// Component tạo hiệu ứng vòng sáng mờ (Blur) làm nền trang trí cho UI
const BlurCircle = ({top="auto", left='auto', right="auto", bottom="auto"}) => {
  return (
    <div 
      className='absolute -z-50 h-58 w-58 aspect-square rounded-full bg-primary/30 blur-3xl' 
      style={{top: top, left: left, right: right, bottom: bottom}}
    ></div>
  )
}

export default BlurCircle