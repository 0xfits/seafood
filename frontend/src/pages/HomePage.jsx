import React from 'react'

const HomePage = () => {
  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-4xl font-bold text-center mb-8">Jinli Club</h1>
      <p className="text-center text-gray-600 mb-8">欢迎来到社区平台</p>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
        <div className="bg-white p-6 rounded-lg shadow-lg">
          <h2 className="text-2xl font-bold mb-4">热门任务</h2>
          <p className="text-gray-600">参与任务赚取积分</p>
          <button className="mt-4 bg-blue-600 text-white px-4 py-2 rounded">查看任务</button>
        </div>
        
        <div className="bg-white p-6 rounded-lg shadow-lg">
          <h2 className="text-2xl font-bold mb-4">精选奖励</h2>
          <p className="text-gray-600">用积分兑换精彩礼品</p>
          <button className="mt-4 bg-yellow-600 text-white px-4 py-2 rounded">查看奖励</button>
        </div>
      </div>
    </div>
  )
}

export default HomePage
