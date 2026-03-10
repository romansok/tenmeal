export default function AboutContent() {
  return (
    <section className="bg-[#FFF8F0] min-h-screen flex items-center justify-center px-6 pt-16">
      <div className="max-w-2xl w-full mx-auto py-20 animate-slide-up">
        <div className="card p-10 md:p-14">
          <h1 className="text-3xl md:text-4xl font-black text-deep-espresso mb-10">
            אודות ארוחת 10
          </h1>
          <div className="space-y-6 text-deep-espresso/70 text-lg leading-relaxed">
            <p>
              אנו מאמינים שאוכל טוב הוא הדלק ללמידה. &quot;ארוחת 10&quot; נולדה מהצורך של הורים לספק
              לילדיהם ארוחה מזינה, מבלי לעמוד במטבח בכל בוקר.
            </p>
            <p>
              אנו לוקחים על עצמנו את משימת ההכנה: כריכים טריים, פירות וירקות, וחומרי גלם איכותיים
              ביותר שמגיעים בדיוק בזמן.
            </p>
            <p className="font-semibold text-deep-espresso">
              תנו לנו לדאוג לארוחה, ואתם תרוויחו בוקר רגוע וזמן איכות עם הילדים.
            </p>
          </div>
          <div className="mt-10 pt-8 border-t border-gray-100">
            <a href="/" className="btn-primary">
              → לעמוד הבית
            </a>
          </div>
        </div>
      </div>
    </section>
  )
}
